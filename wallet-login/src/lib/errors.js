/**
 * errors.js —— 钱包层错误处理（从门票 DApp 的 lib/errors.js 抽出）
 *
 * 原文件里的 REVERT_MAP（把 `Ticket: already claimed` 翻成中文）属于业务，已剔除；
 * 这里只留「钱包/网络」相关的部分。
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

/** 从任意错误对象里认出 EIP-1193 错误码 */
export function codeOf(err) {
  const c = err?.code ?? err?.error?.code ?? err?.info?.error?.code;
  return typeof c === "number" ? c : Number.isFinite(Number(c)) ? Number(c) : null;
}

/**
 * 把钱包抛出的错误翻成能给用户看的中文。
 * 顺序：错误码 → 用户拒绝文案 → Ethers 的 shortMessage → 原始 message
 */
export function friendlyMessage(err) {
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

/* 展示类助手（shortAddress / explorerAddress）放在 lib/format.js，保持与原项目一致的分工 */
