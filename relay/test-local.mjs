/**
 * relay 本地测试 —— 不需要部署、不需要 Cloudflare 账号、不需要浏览器。
 *
 * 原理：Worker 的 handler 只用标准 Web API（Request / Response / fetch / FormData / btoa），
 *       Node 22 原生就有，所以可以直接 `import worker from "./src/index.js"` 当普通函数调用。
 *
 * 三个阶段：
 *   A. 守卫      —— 路由、404、上传参数校验（不需要任何密钥）
 *   B. 验签      —— 随机的假主办方签名必须被 403 拒；真主办方签名必须通过
 *   C. 凭据      —— 若 relay/.dev.vars 里放了 GITHUB_TOKEN，就用只读接口确认
 *                   这份 token 真的有 contents:write（不会提交任何文件）
 *
 * 运行：node relay/test-local.mjs      （在仓库根目录，或 relay/ 里改成 node test-local.mjs）
 *
 * 注意：这个脚本**不会修改 GitHub**（C 阶段只读），也不发链上交易。
 *       真要上传封面请用 `node relay/upload-cover.mjs`。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, Wallet, getAddress } from "ethers";
import worker from "./src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // .../comp7610-ticket-dapp/relay
const ROOT = path.join(HERE, ".."); // .../comp7610-ticket-dapp

/* ------------------------------ 读配置（不打印值） ------------------------------ */

/** 极简 KEY=VALUE 解析，够读 .env / .dev.vars */
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i < 0) continue;
    out[s.slice(0, i).trim()] = s
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

/** 只取 wrangler.toml 的 [vars] 段 —— 避免把同一份配置在测试里再抄一遍 */
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
    out[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^"|"$/g, "");
  }
  return out;
}

const vars = readWranglerVars(); // GITHUB_REPO / PAGES_BASE / PAGES_DIR / RPC_URL / CONTRACT_ADDRESS
const devVars = readEnvFile(path.join(HERE, ".dev.vars"));
const rootEnv = readEnvFile(path.join(ROOT, ".env"));
const TOKEN = devVars.GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
const DEPLOYER_KEY = rootEnv.DEPLOYER_PRIVATE_KEY || "";

/**
 * ★ A / B 两阶段一律用**没有 token** 的 env。
 *   这样「真主办方签名」那一步必然停在 `500 未配置 GITHUB_TOKEN` ——
 *   既证明了验签已经通过（不是 400/403），又保证这个测试永远不会真的往仓库提交文件。
 *   token 有没有配、权限对不对，由 C 阶段用只读接口单独验。
 */
const envNoToken = { ...vars, GITHUB_TOKEN: "" };
const call = (p, init) => worker.fetch(new Request(`https://relay.test${p}`, init), envNoToken);

let failed = 0;
const check = (ok, label) => {
  console.log(`  ${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failed += 1;
};
const skip = (label) => console.log(`  ⏭️  ${label}`);

const provider = new JsonRpcProvider(vars.RPC_URL);
const ticket = new Contract(
  vars.CONTRACT_ADDRESS,
  ["function eventCount() view returns (uint256)", "function getEventInfo(uint256) view returns (tuple(string name,string baseURI,uint64 startAt,uint64 endAt,uint32 maxSupply,uint32 minted,bool open,address organizer))"],
  provider
);

/** 一个字节级合法的最小 PNG（1×1 透明），只用来过「是图片」这一关 */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const pngBlob = () => new Blob([TINY_PNG], { type: "image/png" });

function uploadForm({ eventId, timestamp, signature, name = "x.png", type = "image/png" }) {
  const f = new FormData();
  if (eventId !== undefined) f.append("eventId", String(eventId));
  if (timestamp !== undefined) f.append("timestamp", String(timestamp));
  if (signature !== undefined) f.append("signature", String(signature));
  f.append("image", new Blob([TINY_PNG], { type }), name);
  return f;
}

console.log(`配置来源：wrangler.toml [vars]  ·  PAGES_BASE=${vars.PAGES_BASE}  ·  PAGES_DIR=${vars.PAGES_DIR}`);
console.log(`GITHUB_TOKEN：${TOKEN ? "已配置（来自 relay/.dev.vars）" : "未配置 —— 只影响 C 阶段"}`);
console.log(`DEPLOYER_PRIVATE_KEY：${DEPLOYER_KEY ? "已配置（来自 .env）" : "未配置 —— 只影响 B 阶段后半"}`);

/* ------------------------------- A. 守卫 ------------------------------- */

console.log("\n─ A1. GET /health ─");
{
  const res = await call("/health");
  const body = await res.json();
  check(res.status === 200, `返回 200（实际 ${res.status}）`);
  check(body.pagesDir === vars.PAGES_DIR, `pagesDir = ${body.pagesDir}`);
  check(body.pages === vars.PAGES_BASE, `pages = ${body.pages}`);
  check(typeof body.githubTokenConfigured === "boolean", `githubTokenConfigured = ${body.githubTokenConfigured}`);
}

console.log("\n─ A2. GET /meta/<tokenId>.json ─");
let sample = null;
{
  const count = Number(await ticket.eventCount());
  // 找一张真的领过的票：tokenId 从 1 开始连续分配，所以从 1 往上试
  for (let id = 1; id <= 40; id += 1) {
    try {
      const r = await call(`/meta/${id}.json`);
      if (r.status === 200) {
        sample = { tokenId: id, body: await r.json() };
        break;
      }
    } catch {
      /* 忽略，继续试 */
    }
  }
  if (!sample) {
    skip(`链上暂时没有可读的 ticket（eventCount=${count}），跳过 /meta 内容断言`);
  } else {
    const { tokenId, body } = sample;
    check(typeof body.name === "string" && body.name.length > 0, `token #${tokenId} name 非空：${body.name}`);
    check(
      typeof body.image === "string" && body.image.startsWith(`${vars.PAGES_BASE}/`),
      `image 指向 Pages：${body.image}`
    );
    check(
      Array.isArray(body.attributes) && body.attributes.length >= 1,
      `attributes 齐全（${body.attributes?.length} 项）`
    );
  }

  const missing = await call("/meta/999999.json");
  check(missing.status === 404, `不存在的 token 返回 404（实际 ${missing.status}）`);
}

console.log("\n─ A3. 未知路由 ─");
{
  const res = await call("/nope");
  check(res.status === 404, `返回 404（实际 ${res.status}）`);
}

console.log("\n─ A4. POST /upload 参数守卫 ─");
{
  const now = Math.floor(Date.now() / 1000);

  const noSig = await call("/upload", { method: "POST", body: uploadForm({ eventId: 1, timestamp: now }) });
  check(noSig.status === 400, `缺 signature 被拒（实际 ${noSig.status}）`);

  const stale = await call("/upload", {
    method: "POST",
    body: uploadForm({ eventId: 1, timestamp: now - 3600, signature: "0xdead" }),
  });
  check(stale.status === 400, `过期签名被拒（实际 ${stale.status}）`);

  // eventId 会参与拼仓库路径 —— 必须卡成纯数字
  const inject = await call("/upload", {
    method: "POST",
    body: uploadForm({ eventId: "../../evil", timestamp: now, signature: "0xdead" }),
  });
  check(inject.status === 400, `路径注入型 eventId 被拒（实际 ${inject.status}）`);

  const svg = await call("/upload", {
    method: "POST",
    body: uploadForm({ eventId: 1, timestamp: now, signature: "0xdead", name: "x.svg", type: "image/svg+xml" }),
  });
  check(svg.status === 400, `SVG 被拒（允许列表里故意没有它）（实际 ${svg.status}）`);

  const ghost = await call("/upload", {
    method: "POST",
    body: uploadForm({ eventId: 999999, timestamp: now, signature: "0xdead" }),
  });
  check(ghost.status === 404, `不存在的活动返回 404（实际 ${ghost.status}）`);
}

/* ------------------------- B. 验签（真实的密码学） ------------------------- */

console.log("\n─ B1. 非主办方的签名必须被拒 ─");
{
  const now = Math.floor(Date.now() / 1000);
  const stranger = Wallet.createRandom(); // 临时账户，用完即弃
  const sig = await stranger.signMessage(`ticket-cover:1:${now}`);
  const res = await call("/upload", { method: "POST", body: uploadForm({ eventId: 1, timestamp: now, signature: sig }) });
  const body = await res.json();
  check(res.status === 403, `被 403 拒绝（实际 ${res.status}）`);
  check(/主办方不符/.test(body.error ?? ""), `错误信息明确：${body.error}`);
  console.log(`     （随机地址 ${stranger.address.slice(0, 10)}… 与链上 organizer 不同，符合预期）`);
}

console.log("\n─ B2. 真主办方的签名必须通过 ─");
const targetEventId = Number(process.env.RELAY_TEST_EVENT_ID || 0);
{
  const onchain = await ticket.getEventInfo(targetEventId || 1);
  const organizer = String(onchain.organizer);

  if (!DEPLOYER_KEY) {
    skip("没有 DEPLOYER_PRIVATE_KEY，跳过（把根目录 .env 补上再跑）");
  } else {
    const signer = new Wallet(DEPLOYER_KEY);
    const isOrganizer = getAddress(signer.address) === getAddress(organizer);
    check(isOrganizer, `.env 里的私钥派生出的地址就是活动 #${targetEventId || 1} 的 organizer`);
    if (isOrganizer) {
      const now = Math.floor(Date.now() / 1000);
      const sig = await signer.signMessage(`ticket-cover:${targetEventId || 1}:${now}`);
      const res = await call("/upload", {
        method: "POST",
        body: uploadForm({ eventId: targetEventId || 1, timestamp: now, signature: sig }),
      });
      const body = await res.json();
      // 期望：验签通过之后才会走到 GitHub 那一步 → 500「未配置 GITHUB_TOKEN」。
      // 反过来，只要看到 400/403，就说明验签没过。
      const passedVerification = res.status === 500;
      check(
        passedVerification,
        `真签名通过了验签，停在 GitHub 那一步（HTTP ${res.status}${body.error ? " · " + body.error : ""}）`
      );
      console.log("     （本测试刻意不带 token，所以不会提交任何文件；真上传请用 node relay/upload-cover.mjs）");
    }
  }
}

/* ------------------------- C. 凭据（只读，不提交） ------------------------- */

console.log("\n─ C1. GITHUB_TOKEN 是否有 contents:write ─");
if (!TOKEN) {
  skip("relay/.dev.vars 里没有 GITHUB_TOKEN —— 按 relay/README.md 建一个 fine-grained PAT 再来");
} else {
  const headers = {
    authorization: `Bearer ${TOKEN}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "ticket-dapp-relay",
  };
  try {
    const res = await fetch(`https://api.github.com/repos/${vars.GITHUB_REPO}`, { headers });
    const body = await res.json();
    check(res.status === 200, `token 能读到 ${vars.GITHUB_REPO}（HTTP ${res.status}）`);
    check(body?.permissions?.push === true, `permissions.push = ${body?.permissions?.push}（必须是 true 才能提交）`);
    if (body?.permissions && body.permissions.push !== true) {
      console.log("     → 回 PAT 设置页把 Repository permissions → Contents 改成 Read and write");
    }
  } catch (err) {
    check(false, `访问 GitHub 失败：${err.message}`);
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${vars.GITHUB_REPO}/contents/${vars.PAGES_DIR}`, { headers });
    check(res.ok, `仓库里 ${vars.PAGES_DIR}/ 目录存在（HTTP ${res.status}）`);
  } catch (err) {
    check(false, `读取 ${vars.PAGES_DIR}/ 失败：${err.message}`);
  }
}

console.log(failed === 0 ? "\n全部通过 ✅" : `\n${failed} 项失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
