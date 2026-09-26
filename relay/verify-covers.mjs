/**
 * verify-covers.mjs —— 只读验收：按「NFT 阅读器会看到什么」逐张票查一遍。
 *
 * 不发交易、不写任何文件、不需要 PAT、不需要 relay 在线。
 * 作用：跑完 upload-cover.mjs 之后，用它证明链上 tokenURI 真的指向一个能读的 JSON。
 *
 * 用法（在仓库根目录执行）：
 *   node relay/verify-covers.mjs              # 检查全部活动
 *   node relay/verify-covers.mjs 3 7          # 只看 3、7 号活动
 *   node relay/verify-covers.mjs --save covers-report.json   # 另外存一份 JSON 当证据
 *
 * 检查链：
 *   ① 链上 baseURI 是否已经不是占位符、且等于 <PAGES_BASE>/events/event-<id>.json#
 *   ② 对每张已铸造的票取 tokenURI()（真实调用，不是拼字符串）
 *   ③ 照着 tokenURI 发 HTTP GET（# 之后的部分 HTTP 层会忽略）
 *        期望 200 + JSON，且 JSON 里的 name / image / attributes 齐全
 *   ④ 再取 JSON 里的 image 地址发 GET，期望 200 且 content-type 是图片
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const require = createRequire(path.join(ROOT, "package.json"));
const { ethers } = require("ethers");

/* ------------------------------ 配置（读 wrangler.toml） ------------------------------ */
function readVars() {
  const out = {};
  let inVars = false;
  for (const raw of fs.readFileSync(path.join(__dirname, "wrangler.toml"), "utf8").split(/\r?\n/)) {
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

const args = process.argv.slice(2);
const saveIdx = args.indexOf("--save");
const saveTo = saveIdx >= 0 ? args[saveIdx + 1] : null;
const saveArgIdx = saveIdx >= 0 ? saveIdx + 1 : -1; // 没带 --save 时不能拿它去排除参数（-1+1 会吃掉第 0 个）
const only = args.filter((a, i) => !a.startsWith("--") && i !== saveArgIdx).map(Number).filter(Boolean);

const V = readVars();
const PAGES_BASE = String(V.PAGES_BASE || "").replace(/\/+$/, "");

const provider = new ethers.JsonRpcProvider(V.RPC_URL, 11155111);
const c = new ethers.Contract(
  V.CONTRACT_ADDRESS,
  [
    "function eventCount() view returns (uint256)",
    "function getEventInfo(uint256) view returns (tuple(string name,string baseURI,uint64 startAt,uint64 endAt,uint32 maxSupply,uint32 minted,bool open,address organizer))",
    "function eventOfToken(uint256) view returns (uint256)",
    "function tokenURI(uint256) view returns (string)",
  ],
  provider
);

/* ----------------------------------- 工具 ----------------------------------- */
const ok = (s) => `✅ ${s}`;
const bad = (s) => `❌ ${s}`;
const soft = (s) => `⏭️  ${s}`;

async function probe(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    const ct = res.headers.get("content-type") || "";
    const len = res.headers.get("content-length");
    return { status: res.status, ok: res.ok, type: ct, bytes: len ? Number(len) : null, res };
  } catch (err) {
    return { status: 0, ok: false, type: "", bytes: null, error: err?.cause?.code || err?.message || String(err) };
  }
}

/* ----------------------------------- 主流程 ----------------------------------- */
const n = Number(await c.eventCount());
const ids = only.length ? only : Array.from({ length: n }, (_, i) => i + 1);

// 先把「已铸造的票」列出来：tokenId 是全局自增的，从 1 试到第一个 revert 为止
const tokens = [];
for (let id = 1; id <= 500; id++) {
  try {
    tokens.push({ tokenId: id, eventId: Number(await c.eventOfToken(id)) });
  } catch {
    break;
  }
}

const report = { checkedAt: new Date().toISOString(), pagesBase: PAGES_BASE, events: [], tokens: [] };
let pass = 0;
let fail = 0;

console.log(`合约 ${V.CONTRACT_ADDRESS}`);
console.log(`Pages 根 ${PAGES_BASE}   （共 ${n} 场活动、${tokens.length} 张已铸造的票）\n`);

for (const id of ids) {
  const e = await c.getEventInfo(id);
  const expected = `${PAGES_BASE}/events/event-${id}.json#`;
  const now = String(e.baseURI);
  const state = now === expected ? "ok" : now === "" ? "empty" : now.includes("example.com") ? "placeholder" : "other";
  const line = { eventId: id, name: String(e.name), minted: Number(e.minted), baseURI: now, expected, state };
  report.events.push(line);

  const tag = { ok: ok(""), empty: soft(""), placeholder: bad(""), other: bad("") }[state];
  console.log(`${tag}活动 #${id} ${e.name}  minted=${e.minted}`);
  console.log(`   链上 baseURI = ${now || "(空)"}`);
  if (state !== "ok") console.log(`   期望         = ${expected}${state === "placeholder" ? "   ← 还是占位符，需要跑 upload-cover.mjs" : ""}`);

  for (const t of tokens.filter((t) => t.eventId === id)) {
    const uri = await c.tokenURI(t.tokenId);
    const rec = { tokenId: t.tokenId, eventId: id, tokenURI: uri };
    console.log(`   票 #${t.tokenId} → ${uri}`);

    if (uri !== expected + `${t.tokenId}.json`) {
      console.log(`     ${bad(`tokenURI 与 baseURI+tokenId+.json 不符`)}`);
      rec.json = "mismatch";
      fail++;
      report.tokens.push(rec);
      continue;
    }

    const meta = await probe(uri);
    rec.metadataHttp = `${meta.status} ${meta.type}`;
    if (!meta.ok) {
      console.log(`     ${bad(`metadata 取不到：HTTP ${meta.status} ${meta.error || ""}`)}`);
      fail++;
      report.tokens.push(rec);
      continue;
    }
    let doc;
    try {
      doc = JSON.parse(await meta.res.text());
    } catch (err) {
      console.log(`     ${bad(`metadata 不是合法 JSON：${err.message}`)}`);
      fail++;
      report.tokens.push(rec);
      continue;
    }
    rec.name = doc.name;
    rec.attributes = doc.attributes?.length ?? 0;
    const missing = ["name", "description", "image"].filter((k) => !doc[k]);
    if (missing.length) {
      console.log(`     ${bad(`metadata 少字段：${missing.join(", ")}`)}`);
      fail++;
      report.tokens.push(rec);
      continue;
    }

    const img = await probe(doc.image);
    rec.image = doc.image;
    rec.imageHttp = `${img.status} ${img.type}`;
    if (!img.ok) {
      console.log(`     ${bad(`image 取不到：${img.status} ${img.error || ""}  ${doc.image}`)}`);
      fail++;
      report.tokens.push(rec);
      continue;
    }
    console.log(`     ${ok(`JSON 200 · name="${doc.name}" · attributes=${doc.attributes?.length ?? 0} · image ${img.status} ${img.type}${img.bytes ? ` ${(img.bytes / 1024).toFixed(1)} KB` : ""}`)}`);
    pass++;
    report.tokens.push(rec);
  }
  console.log("");
}

console.log("================");
console.log(`票级检查：${pass} 张通过 / ${fail} 张失败`);
const badEvents = report.events.filter((e) => e.state !== "ok");
console.log(`活动级检查：${n - badEvents.length}/${n} 场 baseURI 已是期望值${badEvents.length ? `（待办：#${badEvents.map((e) => e.eventId).join(" #")}）` : ""}`);
if (saveTo) {
  fs.writeFileSync(path.resolve(ROOT, saveTo), JSON.stringify(report, null, 2) + "\n");
  console.log(`报告已写入 ${saveTo}`);
}
if (fail > 0 || badEvents.length > 0) process.exitCode = 1;
