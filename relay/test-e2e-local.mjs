/**
 * relay/test-e2e-local.mjs —— 路线 2 的**整条链路**端到端测试。
 *
 * 不需要 PAT、不需要 Cloudflare 账号、不需要浏览器、**不发任何链上交易**。
 *
 * 思路：把三个「外部世界」换成进程内的替身，中间跑的全是真代码 ——
 *
 *   前端的真实上传客户端              relay 的真实 Worker               假的 GitHub Contents API
 *   frontend/src/lib/relay.js   →   relay/src/index.js          →   http://127.0.0.1:A
 *   （真 fetch + 真 multipart）      （真验签 + 真 putFile）           （写进临时目录；GET 返回真 git blob sha，
 *                                                                      PUT 带 sha 才是覆盖 —— 与真 GitHub 同语义）
 *                                                                          ↓
 *                                        本地静态服务器（扮演 GitHub Pages） http://127.0.0.1:B
 *                                                                          ↓
 *                              按 NFT 阅读器的方式取 tokenURI → JSON → image，逐个断言 HTTP 200
 *
 * 为什么值得单独写一个脚本：
 *   「baseURI 以 '#' 结尾」这条设计此前只是**推理上**成立（浏览器会把 fragment 丢掉）。
 *   它一旦不成立，要等到用户交完 PAT、发完 12 笔真交易之后才会暴露，而且现象是
 *   「钱包里看不到图」，极难归因。这个脚本把那句推理变成可执行的事实，并且顺带覆盖：
 *     · 前端 coverSignMessage 造出的签名原文与 Worker 验签用的字符串**是否真的是同一个**
 *     · Worker 有没有把 GITHUB_TOKEN 放进 Authorization（没有的话真 GitHub 会 401）
 *     · 覆盖已存在文件时是否带上了 sha（不带会被真 GitHub 拒绝）
 *     · metadata JSON 的形状、image URL 可用性、字节一致性
 *
 * 运行：node relay/test-e2e-local.mjs        （在仓库根目录或 relay/ 里都行）
 *
 * ⚠️ 它只在临时目录里写文件，**不碰 GitHub、不碰链上状态**。
 *    真要上传封面请用 `node relay/upload-cover.mjs`。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Contract, JsonRpcProvider, Wallet, getAddress } from "ethers";
import worker from "./src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // .../comp7610-ticket-dapp/relay
const ROOT = path.join(HERE, ".."); // .../comp7610-ticket-dapp

/* ================================ 断言小工具 ================================ */

const results = [];
const log = (m = "") => console.log(m);
function check(name, ok, extra = "") {
  results.push({ name, ok });
  log(`${ok ? "✅" : "❌"} ${name}${extra ? "  " + extra : ""}`);
}
function note(m) {
  log(`   ${m}`);
}

/* ============================== 读配置（不打印值） ============================== */

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i < 0) continue;
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/** 只取 wrangler.toml 的 [vars] 段，避免把同一份配置在测试里再抄一遍 */
function readWranglerVars() {
  const txt = fs.readFileSync(path.join(HERE, "wrangler.toml"), "utf8");
  const out = {};
  let inVars = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      inVars = line === "[vars]";
      continue;
    }
    if (!inVars) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return out;
}

const vars = readWranglerVars(); // RPC_URL / CONTRACT_ADDRESS / GITHUB_REPO / PAGES_BASE / PAGES_DIR
const rootEnv = readEnvFile(path.join(ROOT, ".env"));
const DEPLOYER_KEY = rootEnv.DEPLOYER_PRIVATE_KEY || "";

/* ============================ 假的 GitHub Contents API ============================ */

/** GitHub 用的就是 git blob sha：sha1("blob <len>\0" + content) */
const blobSha = (buf) => crypto.createHash("sha1").update(`blob ${buf.length}\0`, "utf8").update(buf).digest("hex");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "relay-e2e-"));
const REPO_DIR = path.join(TMP, "repo");
// 把真实仓库的 docs/ 里几个小文件复制进来，于是 Pages 首页 index.html 也是真的那一份
// ⚠️ 不要用 fs.cpSync：本机环境会把它**静默杀掉**（进程直接 127、连一行输出都没有），
//    逐文件复制则完全正常。文件总数是个位数，这么写还更清楚。
const PAGES_SEED = ["index.html", "README.md", "images/.gitkeep", "events/.gitkeep"];
for (const rel of PAGES_SEED) {
  const src = path.join(ROOT, "docs", rel);
  if (!fs.existsSync(src)) continue;
  const dst = path.join(REPO_DIR, "docs", rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, fs.readFileSync(src));
}

const ghLog = [];
const ghServer = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);

  const m = String(req.url || "").match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/);
  const auth = String(req.headers.authorization || "");
  ghLog.push({ method: req.method, url: req.url, auth, overwrote: null });

  const send = (status, obj) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (!m) return send(404, { message: "Not Found" });
  // 真 GitHub 没有凭据就是 401：Worker 有没有把 PAT 放上去，这里能立刻发现
  if (!/^(Bearer|token) \S+/.test(auth)) return send(401, { message: "Requires authentication" });

  const rel = decodeURIComponent(m[3]);
  const abs = path.resolve(REPO_DIR, rel);
  if (!abs.startsWith(REPO_DIR)) return send(400, { message: "bad path" }); // 防穿越

  if (req.method === "GET") {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return send(404, { message: "Not Found" });
    const buf = fs.readFileSync(abs);
    return send(200, { name: path.basename(rel), path: rel, sha: blobSha(buf), size: buf.length });
  }

  if (req.method === "PUT") {
    let body;
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch {
      return send(400, { message: "invalid json" });
    }
    const buf = Buffer.from(String(body.content || ""), "base64");
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
    ghLog[ghLog.length - 1].overwrote = Boolean(body.sha); // 带 sha 才是覆盖已存在的文件
    return send(201, { content: { sha: blobSha(buf) }, commit: { sha: blobSha(Buffer.from(rel + body.message)) } });
  }

  return send(405, { message: "Method Not Allowed" });
});

/* ====================== 本地静态服务器（扮演 GitHub Pages） ====================== */

const EXT_MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".md": "text/plain; charset=utf-8",
};

const PAGES_ROOT = path.join(REPO_DIR, "docs");
const pagesLog = [];
const pagesServer = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(String(req.url || "/"), "http://x").pathname);
  const rel = p === "/" ? "index.html" : p.replace(/^\/+/, "");
  const abs = path.resolve(PAGES_ROOT, rel);
  const ok = abs.startsWith(PAGES_ROOT) && fs.existsSync(abs) && fs.statSync(abs).isFile();
  pagesLog.push({ path: p, status: ok ? 200 : 404 });
  if (!ok) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("404 Not Found");
  }
  res.writeHead(200, {
    "content-type": EXT_MIME[path.extname(abs).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-cache",
  });
  fs.createReadStream(abs).pipe(res);
});

/* ================== 把 Worker 挂到真 HTTP 上（好让前端真 fetch） ================== */

const workerServer = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    // 只转发非空 header：空字符串的 content-type 在 undici 里没意义，少给它一个坑
    const headers = {};
    if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
    if (req.headers.accept) headers.accept = req.headers.accept;
    const request = new Request(`http://relay.local${req.url}`, {
      method: req.method,
      headers,
      body: body.length ? body : undefined,
    });
    const r = await worker.fetch(request, env);
    const out = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "text/plain" });
    res.end(out);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(String(err));
  }
});

const listen = (server) =>
  new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));

/* ================================== 主流程 ================================== */

let relayBase = "";
let ghBase = "";
let pagesBase = "";
let env = null;

function shutdown() {
  for (const s of [ghServer, pagesServer, workerServer]) {
    try {
      s.close();
    } catch {
      /* 忽略 */
    }
  }
}

async function main() {
  log("relay 路线 2 —— 整条链路端到端（本地替身版）");
  log(`临时仓库目录：${REPO_DIR}`);
  log();

  if (!DEPLOYER_KEY) throw new Error("根目录 .env 里没有 DEPLOYER_PRIVATE_KEY —— 验签需要一个真主办方私钥");
  if (!vars.CONTRACT_ADDRESS || !vars.RPC_URL) throw new Error("wrangler.toml 的 [vars] 里缺 CONTRACT_ADDRESS / RPC_URL");

  ghBase = await listen(ghServer);
  pagesBase = await listen(pagesServer);
  relayBase = await listen(workerServer);
  note(`假 GitHub API   ${ghBase}`);
  note(`本地 Pages      ${pagesBase}（充当 wrangler 里 PAGES_BASE 的角色）`);
  note(`实时 Worker     ${relayBase}`);
  log();

  // PAGES_BASE 故意覆盖成本地地址 —— 否则 metadata 里的 image 会指向真 Pages，本地取不到
  env = {
    ...vars,
    GITHUB_API: ghBase,
    PAGES_BASE: pagesBase,
    PAGES_DIR: "docs",
    GITHUB_TOKEN: "local-e2e-token",
  };

  /* ---------- 0. /health 暴露的配置确实是我们要的那一套 ---------- */
  log("─ 0. /health ─");
  const health = await (await fetch(`${relayBase}/health`)).json();
  check("health 报告 githubApi 指向本地替身（说明 GITHUB_API 覆盖生效）", health.githubApi === ghBase, health.githubApi);
  check("health 报告 githubTokenConfigured = true", health.githubTokenConfigured === true);
  check("health 报告 pagesDir = docs", health.pagesDir === "docs");

  /* ---------- 1. 前端签名原文 ↔ Worker 验签字符串 ---------- */
  log();
  log("─ 1. 前端与 Worker 的签名契约 ─");
  const clientSrc = fs.readFileSync(path.join(ROOT, "frontend/src/lib/relay.js"), "utf8");
  const workerSrc = fs.readFileSync(path.join(HERE, "src/index.js"), "utf8");

  // relay.js 顶层读的是 import.meta.env，Node 里没有这个对象；
  // 把它替换掉再 import —— 跑的仍然是 relay.js 的真实源码，只是补上 Vite 本该注入的那点环境。
  const shimmed = `const __ENV__ = { VITE_RELAY_URL: ${JSON.stringify(relayBase)} };\n` + clientSrc.replaceAll("import.meta.env", "__ENV__");
  check("确实替换掉了 relay.js 里的 import.meta.env（否则下面等于没测）", (clientSrc.match(/import\.meta\.env/g) || []).length >= 1);
  const shimPath = path.join(TMP, "relay-client.mjs");
  fs.writeFileSync(shimPath, shimmed, "utf8");
  const client = await import(pathToFileURL(shimPath).href);

  const ts = Math.floor(Date.now() / 1000);
  const msg = client.coverSignMessage(1, ts);
  check("前端的 coverSignMessage 造出正确原文", msg === `ticket-cover:1:${ts}`, msg);
  check(
    "Worker 源码里用的是同一个模板字面量（两处任一改动都会在这里失败）",
    workerSrc.includes("`ticket-cover:${eventId}:${timestamp}`")
  );
  check("前端 RELAY_URL 取自环境（指向本地 Worker）", client.RELAY_URL === relayBase, client.RELAY_URL);

  /* ---------- 2. 链上：这个私钥确实是活动 #1 的主办方 ---------- */
  log();
  log("─ 2. 链上身份 ─");
  const abi = [
    "function owner() view returns (address)",
    "function eventCount() view returns (uint256)",
    "function ticketOf(uint256,address) view returns (uint256)",
    "function getEventInfo(uint256) view returns (tuple(string name,string baseURI,uint64 startAt,uint64 endAt,uint32 maxSupply,uint32 minted,bool open,address organizer))",
  ];
  const chain = new Contract(vars.CONTRACT_ADDRESS, abi, new JsonRpcProvider(vars.RPC_URL));
  const wallet = new Wallet(DEPLOYER_KEY);
  const ev = await chain.getEventInfo(1);
  const organizer = String(ev.organizer);
  check(
    ".env 里的私钥派生地址就是活动 #1 的 organizer",
    getAddress(wallet.address) === getAddress(organizer),
    `${wallet.address} vs ${organizer}`
  );
  note(`活动 #1 名称：「${ev.name}」`);

  /* ---------- 3. 用前端真实客户端上传（真 multipart + 真 Worker + 假 GitHub） ---------- */
  log();
  log("─ 3. 上传 ─");
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  );
  const makeFile = () => new File([PNG], "event-1.png", { type: "image/png" });

  const signature = await wallet.signMessage(msg);
  const up = await client.uploadCover({ eventId: 1, timestamp: ts, signature, file: makeFile() });
  check("前端 uploadCover 走真实 multipart 拿到 ok", up.ok === true);
  check("返回 baseURI 以 # 结尾", typeof up.baseURI === "string" && up.baseURI.endsWith("#"), up.baseURI);
  check("返回的 image 指向 Pages 上的封面", up.image === `${pagesBase}/images/event-1.png`, up.image);
  check("返回的 metadata 指向 Pages 上的 JSON", up.metadata === `${pagesBase}/events/event-1.json`, up.metadata);

  const puts = ghLog.filter((l) => l.method === "PUT");
  const gets = ghLog.filter((l) => l.method === "GET");
  check("Worker 对 GitHub 发了 2 次 GET + 2 次 PUT（先读 sha 再写文件）", gets.length >= 2 && puts.length >= 2, `GET=${gets.length} PUT=${puts.length}`);
  check("每次写请求都带了 Authorization（真 GitHub 没它会 401）", puts.every((p) => /^Bearer /.test(p.auth)));
  check("首次写入不是覆盖（没有 sha）", puts.some((p) => p.overwrote === false));

  /* ---------- 4. 落盘产物 ---------- */
  log();
  log("─ 4. 仓库里真的落了什么 ─");
  const imgAbs = path.join(REPO_DIR, "docs/images/event-1.png");
  const metaAbs = path.join(REPO_DIR, "docs/events/event-1.json");
  check("封面落在 docs/images/event-1.png", fs.existsSync(imgAbs));
  check("封面字节与上传的完全一致", fs.existsSync(imgAbs) && fs.readFileSync(imgAbs).equals(PNG));
  check("metadata 落在 docs/events/event-1.json", fs.existsSync(metaAbs));

  const doc = JSON.parse(fs.readFileSync(metaAbs, "utf8"));
  check("metadata 具备 name / description / image / attributes", Boolean(doc.name && doc.description && doc.image && Array.isArray(doc.attributes)));
  check("metadata.image 就是 Pages 上的封面地址", doc.image === `${pagesBase}/images/event-1.png`);
  const attr = (k) => (doc.attributes.find((a) => a.trait_type === k) || {}).value;
  check("attributes 里有 Event ID = 1", Number(attr("Event ID")) === 1);
  check("attributes 里的 Organizer 是链上那个地址", String(attr("Organizer")).toLowerCase() === organizer.toLowerCase());
  check("attributes 里的 Event 名称与链上一致", String(attr("Event")) === String(ev.name));
  note(`metadata.name = ${JSON.stringify(doc.name)}`);

  /* ---------- 5. ★ 读路径：按 NFT 阅读器的方式取 tokenURI ---------- */
  log();
  log("─ 5. ★ tokenURI → JSON → image（这条才是「钱包里能不能看到图」的判据） ─");
  const tokenUris = [1, 2, 3].map((id) => `${up.baseURI}${id}.json`);
  check("不同 tokenId 的 tokenURI 字符串互不相同（唯一性不受 # 影响）", new Set(tokenUris).size === 3);
  note(`tokenURI(1) = ${tokenUris[0]}`);
  note(`tokenURI(2) = ${tokenUris[1]}`);

  const fetched = [];
  for (const u of tokenUris) {
    const r = await fetch(u); // ⚠️ 这里拼的是**带 fragment 的完整字符串**，由 fetch 自己去丢
    fetched.push({ status: r.status, doc: r.ok ? await r.json() : null });
  }
  check("三个 tokenURI 全部 200", fetched.every((f) => f.status === 200), fetched.map((f) => f.status).join(","));
  check(
    "整场活动的票读到的是同一份 JSON（这正是 # 的意义）",
    fetched.every((f) => f.doc && f.doc.name === doc.name && f.doc.image === doc.image)
  );

  const naive = await fetch(`${pagesBase}/events/event-1.json/1.json`);
  check("反证：把 tokenId 直接拼进路径时 Pages 上并没有这个文件 → 404", naive.status === 404, String(naive.status));

  const imgRes = await fetch(doc.image);
  check("metadata 里的 image 真的能取到（200 + image/png）", imgRes.ok && imgRes.headers.get("content-type") === "image/png", imgRes.headers.get("content-type"));
  check("取回的封面字节与上传的一致", Buffer.from(await imgRes.arrayBuffer()).equals(PNG));

  const idx = await fetch(`${pagesBase}/`);
  const html = await idx.text();
  check("Pages 首页本身也能取到（docs/index.html 一起被托管）", idx.ok && html.includes("<html"));
  check("首页探测的地址形态 events/event-*.json 与我们写入的路径一致", html.includes("events/event-"));

  /* ---------- 6. 覆盖语义：第二次上传必须带上已有 sha ---------- */
  log();
  log("─ 6. 重复上传 = 覆盖（换封面要能生效） ─");
  const ts2 = Math.floor(Date.now() / 1000);
  const sig2 = await wallet.signMessage(client.coverSignMessage(1, ts2));
  const up2 = await client.uploadCover({ eventId: 1, timestamp: ts2, signature: sig2, file: makeFile() });
  check("第二次上传同样成功", up2.ok === true);
  const puts2 = ghLog.filter((l) => l.method === "PUT");
  check("第二次 PUT 带上了已有 sha（= 覆盖），否则真 GitHub 会 409/422", puts2[puts2.length - 1]?.overwrote === true);
  check("覆盖后读到的还是同一份 metadata（内容没坏）", (await (await fetch(up2.baseURI + "1.json")).json()).image === doc.image);

  /* ---------- 7. 可选的动态路线 /meta/<tokenId>.json ---------- */
  log();
  log("─ 7. 可选：GET /meta/<tokenId>.json ─");
  let myToken = null;
  const count = Number(await chain.eventCount());
  for (let id = 1; id <= count && myToken === null; id += 1) {
    const t = await chain.ticketOf(id, wallet.address);
    if (t !== 0n) myToken = Number(t);
  }
  if (myToken === null) {
    log(`⏭️  主办方名下没有已领取的票，跳过（这不影响上面的结论）`);
  } else {
    const r = await fetch(`${relayBase}/meta/${myToken}.json`);
    const body = r.ok ? await r.json() : null;
    check(`/meta/${myToken}.json 返回 200`, r.status === 200, String(r.status));
    check("动态 metadata 里补上了 Token ID 属性", Boolean(body && body.attributes.some((a) => a.trait_type === "Token ID" && Number(a.value) === myToken)));
    check("动态 metadata 带 image 字段", Boolean(body && body.image), body?.image);
    check("自引用保护生效：没有无限递归（能正常返回就是证据）", r.ok);
  }

  /* ---------- 汇总 ---------- */
  const ok = results.filter((r) => r.ok).length;
  log();
  log(`================ 结果：${ok}/${results.length} 通过 ================`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    log("未通过：");
    failed.forEach((f) => log(`  - ${f.name}`));
    process.exitCode = 1;
  }
  log();
  log(`（临时产物保留在 ${TMP} —— 里面就是「仓库」与「Pages 站点」，可以直接翻）`);
}

main()
  .catch((e) => {
    console.error("\nfatal:", e);
    process.exitCode = 1;
  })
  .finally(() => shutdown());
