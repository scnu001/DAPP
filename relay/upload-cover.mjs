/**
 * upload-cover.mjs —— 命令行版的「上传封面 + 更新链上 baseURI」。
 *
 * 和浏览器上传走**完全相同的代码路径**：直接把 relay 的 Worker handler
 * `import` 进来调用（`worker.fetch(...)`），而不是把提交逻辑再写一遍。
 * 区别只在凭据来源 —— 这里从 relay/.dev.vars 读 PAT、从根目录 .env 读主办方私钥。
 *
 * 两个用途：
 *   · 批量给已有活动补封面（浏览器界面一次只能传一个）
 *   · 在**不部署 Worker** 的前提下先把 metadata 弄好（纯命令行路线）
 *
 * 用法（在仓库根目录执行）：
 *   node relay/upload-cover.mjs 3 covers/event-3.png          # 一个活动
 *   node relay/upload-cover.mjs 3 covers/event-3.png --no-chain  # 只提交文件，不发交易
 *   node relay/upload-cover.mjs --all covers/                 # 目录里所有 event-<id>.<ext>
 *
 * 会做的检查：私钥派生出的地址必须是该活动的 organizer（否则那笔 updateEventURI 会 revert）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, Wallet, getAddress } from "ethers";
import worker from "./src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

/* ------------------------------- 配置读取 ------------------------------- */

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

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/* -------------------------------- 主流程 -------------------------------- */

const args = process.argv.slice(2);
const NO_CHAIN = args.includes("--no-chain");
const positional = args.filter((a) => !a.startsWith("--"));
const allDir = args.includes("--all") ? positional[0] : null;

const vars = readWranglerVars();
const devVars = readEnvFile(path.join(HERE, ".dev.vars"));
const rootEnv = readEnvFile(path.join(ROOT, ".env"));
const TOKEN = devVars.GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
const KEY = rootEnv.DEPLOYER_PRIVATE_KEY || "";

const die = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

if (!TOKEN) {
  die(
    "没有 GITHUB_TOKEN。\n" +
      `  建一个 fine-grained PAT（只授权 ${vars.GITHUB_REPO}，权限 Contents: Read and write），\n` +
      "  写进 relay/.dev.vars：\n" +
      "    GITHUB_TOKEN=github_pat_xxx\n" +
      "  该文件已被 .gitignore 排除，不会入库。"
  );
}
if (!KEY) die(`没有 DEPLOYER_PRIVATE_KEY —— 检查 ${path.join(ROOT, ".env")}`);

const provider = new JsonRpcProvider(vars.RPC_URL);
const signer = new Wallet(KEY, provider);
const abi = [
  "function getEventInfo(uint256) view returns (tuple(string name,string baseURI,uint64 startAt,uint64 endAt,uint32 maxSupply,uint32 minted,bool open,address organizer))",
  "function eventCount() view returns (uint256)",
  "function updateEventURI(uint256 eventId, string baseURI)",
];
const read = new Contract(vars.CONTRACT_ADDRESS, abi, provider);
const write = new Contract(vars.CONTRACT_ADDRESS, abi, signer);
const env = { ...vars, GITHUB_TOKEN: TOKEN };

/** 收集「eventId → 图片路径」的待办清单 */
function collectJobs() {
  if (!allDir) {
    const [id, file] = positional;
    if (!id || !file) {
      die("用法：node relay/upload-cover.mjs <eventId> <图片路径>  |  --all <目录>");
    }
    return [{ eventId: Number(id), file }];
  }
  if (!fs.existsSync(allDir)) die(`目录不存在：${allDir}`);
  const jobs = [];
  for (const name of fs.readdirSync(allDir)) {
    const m = name.match(/^event-(\d+)\.(png|jpe?g|webp|gif)$/i);
    if (!m) continue;
    jobs.push({ eventId: Number(m[1]), file: path.join(allDir, name) });
  }
  jobs.sort((a, b) => a.eventId - b.eventId);
  if (jobs.length === 0) die(`${allDir} 里没有形如 event-<id>.png 的文件`);
  return jobs;
}

async function uploadOne({ eventId, file }) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) die(`不支持的图片类型：${ext}（只接受 png / jpg / jpeg / webp / gif）`);
  if (!fs.existsSync(file)) die(`图片不存在：${file}`);

  const info = await read.getEventInfo(eventId);
  const organizer = String(info.organizer);
  if (getAddress(organizer) !== getAddress(signer.address)) {
    die(
      `活动 #${eventId} 的 organizer 是 ${organizer}，` +
        `而 .env 里的私钥派生出的地址是 ${signer.address} —— 不是同一个账户，不能用它上传。`
    );
  }

  const bytes = new Uint8Array(fs.readFileSync(file));
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await signer.signMessage(`ticket-cover:${eventId}:${timestamp}`);

  const form = new FormData();
  form.append("eventId", String(eventId));
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("image", new Blob([bytes], { type: mime }), path.basename(file));

  console.log(`\n[#${eventId}] ${info.name}`);
  console.log(`  图片 ${path.basename(file)} (${(bytes.length / 1024).toFixed(1)} KB, ${mime})`);
  console.log(`  签名 ticket-cover:${eventId}:${timestamp}`);

  const res = await worker.fetch(new Request("https://relay.test/upload", { method: "POST", body: form }), env);
  const body = await res.json();
  if (!res.ok || !body.ok) {
    console.log(`  ✗ relay 拒绝（HTTP ${res.status}）：${body.error}${body.detail ? " · " + body.detail : ""}`);
    return { eventId, ok: false };
  }
  console.log(`  ✓ 已提交：${body.image}`);
  console.log(`    metadata：${body.metadata}`);

  if (NO_CHAIN) {
    console.log("  ⏭️  --no-chain：跳过 updateEventURI");
    return { eventId, ok: true, skippedChain: true };
  }
  if (String(info.baseURI) === body.baseURI) {
    console.log("  ⏭️  链上 baseURI 已经是这个值，跳过交易（省 gas）");
    return { eventId, ok: true, skippedChain: true };
  }

  // 费率给足一点 —— 挂进 mempool 等十分钟比多花一点测试币难受得多
  const fee = await provider.getFeeData();
  const overrides = {};
  if (fee.maxFeePerGas) overrides.maxFeePerGas = (fee.maxFeePerGas * 15n) / 10n;
  if (fee.maxPriorityFeePerGas) overrides.maxPriorityFeePerGas = (fee.maxPriorityFeePerGas * 15n) / 10n;

  const tx = await write.updateEventURI(eventId, body.baseURI, overrides);
  console.log(`  ⏳ updateEventURI 已发出：${tx.hash}`);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    console.log("  ✗ 交易上链但执行失败");
    return { eventId, ok: false };
  }
  console.log(`  ✓ 链上已生效（gas ${receipt.gasUsed}）· ${vars.PAGES_BASE}/… 现在可读`);
  return { eventId, ok: true, tx: tx.hash };
}

const jobs = collectJobs();
console.log(`relay 上传：${jobs.length} 个活动  ·  organizer ${signer.address}`);
const balance = await provider.getBalance(signer.address);
console.log(`余额 ${Number(balance) / 1e18} ETH${balance === 0n && !NO_CHAIN ? "  ⚠️ 为 0，发不了 updateEventURI" : ""}`);

const results = [];
for (const job of jobs) {
  try {
    results.push(await uploadOne(job));
  } catch (err) {
    console.log(`  ✗ 异常：${err?.shortMessage ?? err?.message ?? err}`);
    results.push({ eventId: job.eventId, ok: false });
  }
  await new Promise((r) => setTimeout(r, 800)); // 别把 GitHub API 打太密
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n================ ${ok}/${results.length} 成功 ================`);
if (ok < results.length) {
  console.log("失败：", results.filter((r) => !r.ok).map((r) => `#${r.eventId}`).join(" "));
  process.exitCode = 1;
} else {
  console.log(`提示：GitHub Pages 发布有 30-60 秒延迟，稍后再去 ${vars.PAGES_BASE} 看图。`);
}
