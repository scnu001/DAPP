import { SEPOLIA_EXPLORER_URL } from "./contract";

/** 0x1234…abcd */
export function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function explorerAddress(addr) {
  return `${SEPOLIA_EXPLORER_URL}/address/${addr}`;
}

export function explorerTx(hash) {
  return `${SEPOLIA_EXPLORER_URL}/tx/${hash}`;
}

/** 某个 NFT 实例在 Etherscan 上的页面 */
export function explorerNft(contract, tokenId) {
  return `${SEPOLIA_EXPLORER_URL}/token/${contract}?a=${tokenId}`;
}

export function explorerContract(addr) {
  return `${SEPOLIA_EXPLORER_URL}/address/${addr}#code`;
}

/** uint64 秒 -> 本地时间字符串；0 表示不限制 */
export function formatTime(seconds) {
  const s = Number(seconds);
  if (!s) return "不限制";
  return new Date(s * 1000).toLocaleString();
}

/** 0 = 不限制；用于 <input type="datetime-local"> 的回显 */
export function toDatetimeLocal(seconds) {
  const s = Number(seconds);
  if (!s) return "";
  const d = new Date(s * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/** <input type="datetime-local"> 的值 -> uint64 秒（本地时区） */
export function datetimeLocalToSeconds(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
}
