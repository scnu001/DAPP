/**
 * errors.js —— 钱包 / 网络层错误处理。
 *
 * 这里只认识 EIP-1193 与 EIP-3326 的标准错误码，**不认识任何合约 revert**。
 * 合约 revert 的解析（require 文案 → 中文）属于业务层，
 * 放在 `frontend/src/lib/errors.js`（decodeRevert / friendlyMessage）。
 *
 * 两层的分工：
 *   钱包层  friendlyWalletError(err)  ← 用户拒绝、钱包未授权、链不存在…
 *   业务层  decodeRevert(err, iface)  ← 合约 require / 自定义 error
 * 业务层可以把自己解析出的 reason 再交给 friendlyWalletError 兜底。
 */
import { SEPOLIA_CHAIN_ID, SEPOLIA_CHAIN_ID_DEC } from "./chain";

/** EIP-1193 标准错误码 → 中文人话 */
const EIP1193_CODES = {
  4001: "你在钱包里取消了这次操作",
  4100: "钱包未授权（需要先连接钱包）",
  4200: "钱包不支持该方法",
  4900: "钱包与节点断开连接",
  4901: "钱包未连接到该网络",
  4902: "钱包里还没有 Sepolia 这个网络（需先添加）",
};

/** 用户拒绝的各种文案（不同钱包措辞不同） */
const USER_REJECT_HINTS = [
  "user rejected",
  "user denied",
  "user canceled",
  "ACTION_REJECTED",
  "用户拒绝",
  "用户取消",
];

/**
 * 当前 chainId 是否是 Sepolia。
 * ⚠️ 必须容忍 4 种输入：事件里给的是 "0xaa36a7" 字符串，getNetwork() 给的是 bigint，
 *    有些地方给十进制 number。严格比较会漏判。
 */
export function isSepolia(chainId) {
  if (chainId === undefined || chainId === null || chainId === "") return false;
  if (typeof chainId === "bigint") return Number(chainId) === SEPOLIA_CHAIN_ID_DEC;
  if (typeof chainId === "number") return chainId === SEPOLIA_CHAIN_ID_DEC;
  const raw = String(chainId).toLowerCase();
  return raw === SEPOLIA_CHAIN_ID.toLowerCase() || Number(raw) === SEPOLIA_CHAIN_ID_DEC;
}

/** 从任意错误对象里认出 EIP-1193 错误码（不同钱包把 code 藏在不同层级） */
export function codeOf(err) {
  const c = err?.code ?? err?.error?.code ?? err?.info?.error?.code;
  return typeof c === "number" ? c : Number.isFinite(Number(c)) ? Number(c) : null;
}

/** 这次失败是不是「用户在钱包里点了拒绝」 */
export function isUserRejection(err) {
  if (codeOf(err) === 4001) return true;
  const text = String(err?.message ?? err ?? "").toLowerCase();
  return USER_REJECT_HINTS.some((needle) => text.includes(needle.toLowerCase()));
}

/**
 * 把钱包抛出的错误翻成能给用户看的中文。
 * 顺序：错误码 → 用户拒绝文案 → Ethers 的 shortMessage → 原始 message
 */
export function friendlyWalletError(err) {
  if (!err) return "未知错误";

  const code = codeOf(err);
  if (code && EIP1193_CODES[code]) return EIP1193_CODES[code];

  const text = String(err?.message ?? err);
  const lower = text.toLowerCase();
  for (const needle of USER_REJECT_HINTS) {
    if (lower.includes(needle.toLowerCase())) return "你在钱包里取消了这次操作";
  }

  if (typeof err?.shortMessage === "string" && err.shortMessage) return err.shortMessage;
  if (err?.info?.error?.message) return String(err.info.error.message);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}
