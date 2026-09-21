/**
 * format.js —— 业务层展示助手。
 *
 * 「地址缩略 + 浏览器地址页」这两个是钱包层的通用能力，直接复用共享模块，不再复制第二份；
 * 本文件只补合约业务需要的时间 / 交易 / NFT 相关格式化。
 */
import { SEPOLIA_EXPLORER_URL } from "@wallet";

/* 地址类：单一真源在 @wallet —— 这里 re-export，让老的 `../lib/format` 引用继续可用 */
export { shortAddress, explorerAddress } from "@wallet";

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
