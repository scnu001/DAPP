/**
 * format.js —— 展示用格式化助手
 *
 * 从门票 DApp 的 `frontend/src/lib/format.js` 抽出，只保留钱包 UI 用得到的两个。
 * 原文件里的 explorerTx / explorerNft / formatTime / datetimeLocalToSeconds 都跟合约业务相关，已剔除。
 */
import { SEPOLIA_EXPLORER_URL } from "./chain";

/** 0x1234…abcd —— 地址太长，界面上只显示头 6 位 + 尾 4 位 */
export function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** 点地址跳到区块链浏览器（只读，不涉及任何签名） */
export function explorerAddress(addr) {
  return `${SEPOLIA_EXPLORER_URL}/address/${addr}`;
}
