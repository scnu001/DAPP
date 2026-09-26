/**
 * bench-reads.mjs —— 活动列表读路径的请求数基准（可复现的性能证据）。
 *
 * 对比两种写法：
 *   A：逐 id 调用 getEventInfo / ticketOf（改动前的写法）
 *   B：经 Multicall3 一次打包（改动后的写法，见 frontend/src/lib/multicall.js）
 *
 * 度量的是「HTTP 请求数」与「JSON-RPC 调用数」——注意两者不同：
 *   ethers v6 的 JsonRpcProvider 已自带 HTTP 层批处理，所以 A 的 JSON-RPC 调用会被合并进
 *   少数几个 HTTP POST 里。真正的成本是 JSON-RPC 调用数（免费 RPC 按调用数 / 计算单元计费，
 *   且批大小超过 batchMaxCount=100 会被切开，部分公共 RPC 还会直接拒绝过大的批）。
 *
 * 运行：node scripts/bench-reads.mjs
 * 需要：仓库根目录的 node_modules（ethers）+ 可访问的 Sepolia 公共 RPC。
 */
import { JsonRpcProvider, Contract, FetchRequest } from "ethers";

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const ADDR = process.env.CONTRACT_ADDRESS || "0x567eC107b7abD99D1882476fb9336cc134de942f";
const MC = "0xcA11bde05977b3631167028862bE2a173976CA11";
const ACCOUNT = process.env.BENCH_ACCOUNT || "0xd40C8610d18119cd8C7A5B44Aaa2981cDC0b3E73";

const ABI = [
  "function eventCount() view returns (uint256)",
  "function owner() view returns (address)",
  "function getEventInfo(uint256) view returns (tuple(string name,string baseURI,uint64 startAt,uint64 endAt,uint32 maxSupply,uint32 minted,bool open,address organizer))",
  "function ticketOf(uint256,address) view returns (uint256)",
];
// Multicall3 里 aggregate3 是 payable；这里按只读声明为 view，让 ethers 走 eth_call
const MC_ABI = [
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[] results)",
];

/* ---------------------- 计数钩子 ---------------------- */
let http = 0;
let rpc = 0;
let batches = [];
const decoder = new TextDecoder();
const defaultGetUrl = FetchRequest.createGetUrlFunc();
FetchRequest.registerGetUrl((req) => {
  http += 1;
  try {
    const text = typeof req.body === "string" ? req.body : decoder.decode(req.body);
    const parsed = JSON.parse(text);
    const size = Array.isArray(parsed) ? parsed.length : 1;
    rpc += size;
    batches.push(size);
  } catch {
    rpc += 1;
    batches.push(-1);
  }
  return defaultGetUrl(req);
});
const reset = () => {
  http = 0;
  rpc = 0;
  batches = [];
};

const provider = new JsonRpcProvider(RPC);
const ticket = new Contract(ADDR, ABI, provider);
const mc = new Contract(MC, MC_ABI, provider);

const n = Number(await ticket.eventCount());
const ids = Array.from({ length: n }, (_, i) => i + 1);
const target = await ticket.getAddress();
const iface = ticket.interface;
const mkCalls = (name, argsList) =>
  argsList.map((args) => ({ target, allowFailure: false, callData: iface.encodeFunctionData(name, args) }));
// decodeFunctionResult 返回 outputs 数组，单 output（元组）时要取 [0]
const decodeSingle = (name, data) => {
  const out = iface.decodeFunctionResult(name, data);
  return out.length === 1 ? out[0] : out;
};

console.log(`合约 ${ADDR}`);
console.log(`活动数 n = ${n}\n`);

/* ---------------------- A：逐 id 调用 ---------------------- */
reset();
const aEvents = await Promise.all(ids.map((id) => ticket.getEventInfo(id)));
const aTokens = await Promise.all(ids.map((id) => ticket.ticketOf(id, ACCOUNT)));
const aHttp = http;
const aRpc = rpc;

/* ---------------------- B：Multicall3 ---------------------- */
reset();
const bEvents = (await mc.aggregate3(mkCalls("getEventInfo", ids.map((id) => [id])))).map((r) =>
  decodeSingle("getEventInfo", r.returnData)
);
const bTokens = (await mc.aggregate3(mkCalls("ticketOf", ids.map((id) => [id, ACCOUNT])))).map((r) =>
  decodeSingle("ticketOf", r.returnData)
);
const bHttp = http;
const bRpc = rpc;

console.log("读全部活动（getEventInfo × N 与 ticketOf × N）的请求数：");
console.log(`  A 逐 id 调用      HTTP ${aHttp} 次 | JSON-RPC ${aRpc} 个`);
console.log(`  B Multicall3      HTTP ${bHttp} 次 | JSON-RPC ${bRpc} 个`);

const same =
  aEvents.length === bEvents.length &&
  aEvents.every((e, i) => e.name === bEvents[i].name && Number(e.minted) === Number(bEvents[i].minted)) &&
  aTokens.every((t, i) => BigInt(t) === BigInt(bTokens[i]));
console.log(`\n  结果一致性：${same ? "一致 ✓" : "不一致 ✗"}（${aEvents.length} 个活动 / ${aTokens.length} 个 ticketOf）`);

/* ---------------------- 活动数增长时的形态 ---------------------- */
console.log("\n活动数增长时的形态（用重复 id 放大，只看请求形态）：");
console.log("  N        A: HTTP / JSON-RPC      B: HTTP / JSON-RPC");
for (const M of [50, 200, 500]) {
  const big = Array.from({ length: M }, (_, i) => (i % n) + 1);

  reset();
  await Promise.all(big.map((id) => ticket.getEventInfo(id)));
  const ah = http;
  const ar = rpc;

  reset();
  await mc.aggregate3(mkCalls("getEventInfo", big.map((id) => [id])));
  const bh = http;
  const br = rpc;

  console.log(`  ${String(M).padEnd(6)}   ${String(ah).padStart(3)} / ${String(ar).padStart(5)}          ${String(bh).padStart(3)} / ${String(br).padStart(4)}`);
}

process.exit(0);
