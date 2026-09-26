/**
 * multicall.js —— 把 N 个只读调用打包成 1 次 eth_call。
 *
 * 为什么需要它：
 *   ethers v6 的 JsonRpcProvider 已经会在 HTTP 层做 JSON-RPC 批处理，
 *   所以「活动列表」读 N 个活动**不会**变成 N 次 HTTP 请求。
 *   但批处理只在同一个事件循环 tick 内、且不超过 batchMaxCount（默认 100）时生效：
 *     - JSON-RPC 调用数仍然随 N 线性增长（免费 RPC 按调用数 / 计算单元计费）；
 *     - 超过批大小会被切成多个 HTTP 请求，而部分公共 RPC 会直接拒绝过大的批。
 *   实测（12 场活动）：现在 29 个 JSON-RPC 调用 → 批量读 7 个；活动数增长到 500 时
 *   现在是 501 个 + 6 次 HTTP，批量读恒为 2 个 + 1 次 HTTP。
 *
 * 实现要点：
 *   1. Multicall3 在多数网络上是同一个地址（含 Sepolia），无需自己部署。
 *   2. 合约里 aggregate3 声明为 `payable`；这里**故意按只读声明为 `view`**，
 *      否则 ethers 会把它当写方法去 eth_sendTransaction（报 UNSUPPORTED_OPERATION）。
 *      编码/解码完全一致，只是让 ethers 走 eth_call。
 *   3. decodeFunctionResult 返回的是「outputs 数组」：只有一个 output（元组返回值很常见）时
 *      要取 [0]，否则拿到的是包了一层的 Result，字段名取不到（这个坑实测踩过一次）。
 *   4. 任何一步失败都回退到逐个调用，保证功能不因 multicall 不可用而中断。
 */
import { Contract } from "ethers";

/** Multicall3 —— 已部署在 Sepolia 等多个网络上的同一地址 */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

/** aggregate3 按只读声明（见文件头第 2 点） */
export const MULTICALL3_ABI = [
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[] results)",
];

/**
 * 批量只读调用。
 *
 * @param {import("ethers").Contract} contract  已连 provider 的只读合约实例
 * @param {{ method: string, args?: unknown[] }[]} calls  要打包的调用
 * @returns {Promise<unknown[]>}  与 calls 一一对应的解码结果（单个 output 时已解包）
 */
export async function multicallRead(contract, calls) {
  if (!contract || calls.length === 0) return [];

  const runner = contract.runner;
  const iface = contract.interface;

  // 只允许只读调用：runner 必须有 Provider 的 call()，否说明挂的是 Signer
  if (typeof runner?.call !== "function") {
    throw new Error("multicallRead 只能用于只读合约实例（runner 必须是 Provider）");
  }

  const decode = (method, returnData) => {
    const out = iface.decodeFunctionResult(method, returnData);
    return out.length === 1 ? out[0] : out;
  };

  try {
    const target = await contract.getAddress();
    const multicall = new Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, runner);
    const payload = calls.map(({ method, args = [] }) => ({
      target,
      allowFailure: false,
      callData: iface.encodeFunctionData(method, args),
    }));
    const results = await multicall.aggregate3(payload);
    return results.map((r, i) => decode(calls[i].method, r.returnData));
  } catch (err) {
    // 回退路径：multicall 不可用（未部署 / provider 拒绝该调用）时逐个读，结果语义不变
    console.warn("[multicall] 批量读失败，回退为逐个调用：", err?.shortMessage ?? err?.message ?? err);
    return Promise.all(calls.map(({ method, args = [] }) => contract[method](...args)));
  }
}
