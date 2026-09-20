import { SEPOLIA_CHAIN_ID, SEPOLIA_CHAIN_ID_DEC } from "./contract";

/** 合约 require 字符串 -> 中文人话提示 */
const REVERT_MAP = [
  ["Ticket: event not found", "活动不存在"],
  ["Ticket: event closed", "活动已关闭，停止发放"],
  ["Ticket: already closed", "活动已经是关闭状态了"],
  ["Ticket: not started", "领取还没开始"],
  ["Ticket: event ended", "领取已结束"],
  ["Ticket: sold out", "票已领完"],
  ["Ticket: already claimed", "你已经领过这场活动的票了（每人每活动限一张）"],
  ["Ticket: zero supply", "门票上限必须大于 0"],
  ["Ticket: bad time range", "结束时间必须晚于开始时间"],
  ["Ticket: not organizer", "只有主办方可以执行该操作"],
  ["OwnableUnauthorizedAccount", "只有合约 owner 可以创建活动"],
  ["ERC721InvalidReceiver", "接收地址不支持 NFT（不能是合约）"],
];

const USER_REJECT_HINTS = [
  "user rejected",
  "user denied",
  "ACTION_REJECTED",
  "用户拒绝",
];

/**
 * 取出 revert 的原始 data（0x 开头的十六进制）。
 * ⚠️ Ethers v6 在不同 provider 下 err.data 的类型不一样：
 *    - MetaMask / BrowserProvider：err.data 是 hex 字符串
 *    - Hardhat / JsonRpcProvider：err.data 是对象 { data, message, txHash }
 *    也可能藏在 err.error.data 或 err.info.error.data 里，所以全部试一遍。
 */
export function extractRevertData(err) {
  if (!err) return null;
  const candidates = [
    err.data,
    err?.error?.data,
    err?.info?.error?.data,
    err?.revert?.data,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("0x")) return c;
    if (c && typeof c === "object" && typeof c.data === "string" && c.data.startsWith("0x")) {
      return c.data;
    }
  }
  return null;
}

/**
 * 从 Ethers v6 抛出的错误里尽量取出 revert 原因。
 * v6 各字段可靠性不一，所以按优先级逐个尝试：
 *   err.revert.args[0]（require 字符串）/ err.revert.name（自定义 error）/ err.reason / err.shortMessage /
 *   err.info.error.message / interface.parseError(原始 data)
 */
export function decodeRevert(err, iface) {
  if (!err) return "未知错误";

  if (err.revert && typeof err.revert === "object") {
    if (err.revert.name === "Error" && err.revert.args && err.revert.args[0]) {
      return String(err.revert.args[0]);
    }
    if (err.revert.name) return String(err.revert.name);
  }
  if (typeof err.reason === "string" && err.reason) return err.reason;

  // 先用原始 data 精确解码（自定义 error 的场景）
  const data = extractRevertData(err);
  if (iface && data) {
    try {
      const parsed = iface.parseError(data);
      if (parsed) {
        return parsed.name === "Error" && parsed.args && parsed.args[0]
          ? String(parsed.args[0])
          : parsed.name;
      }
    } catch {
      /* 解析不了就继续 */
    }
  }

  if (typeof err.shortMessage === "string" && err.shortMessage) return err.shortMessage;
  if (err.info && err.info.error && err.info.error.message) return String(err.info.error.message);
  return String(err.message || err);
}

/** 把 decodeRevert 的结果翻译成中文提示；认不出来时原样返回 */
export function friendlyMessage(reason) {
  if (!reason) return "未知错误";
  const text = String(reason);
  for (const [needle, msg] of REVERT_MAP) {
    if (text.includes(needle)) return msg;
  }
  for (const needle of USER_REJECT_HINTS) {
    if (text.toLowerCase().includes(needle.toLowerCase())) return "你在钱包里取消了这笔交易";
  }
  if (text.length > 160) return `${text.slice(0, 160)}…`;
  return text;
}

/** 当前 chainId 是否是 Sepolia（容忍大小写与十进制） */
export function isSepolia(chainId) {
  if (chainId === undefined || chainId === null || chainId === "") return false;
  if (typeof chainId === "bigint") return Number(chainId) === SEPOLIA_CHAIN_ID_DEC;
  if (typeof chainId === "number") return chainId === SEPOLIA_CHAIN_ID_DEC;
  const raw = String(chainId).toLowerCase();
  return raw === SEPOLIA_CHAIN_ID.toLowerCase() || Number(raw) === SEPOLIA_CHAIN_ID_DEC;
}
