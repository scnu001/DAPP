/**
 * format.js —— 钱包 UI 用得到的展示助手。
 *
 * 只负责「地址看起来好看一点 + 拼浏览器链接」，不认识合约、时间戳、tokenId。
 * 业务层的格式化（explorerTx / explorerNft / formatTime …）在各自项目里。
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
