/**
 * receipt 日志解析 —— 前端拿「交易函数返回值」的唯一途径。
 *
 * receipt.logs 里不只有本合约的日志（还会有别的合约的），
 * 所以必须逐个尝试 parseLog 并按 name 过滤，不能直接取 logs[0]。
 */

/** 把一条交易回执里的所有日志解析成 [{name, args}]，解析不了的跳过 */
export function parseLogs(contract, receipt) {
  const out = [];
  if (!receipt || !Array.isArray(receipt.logs)) return out;

  for (const log of receipt.logs) {
    let parsed = null;
    try {
      parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
    } catch {
      continue; // 不是本合约 ABI 能解释的日志
    }
    if (parsed) out.push(parsed);
  }
  return out;
}

/** 找指定事件（找不到返回 null） */
export function findLog(contract, receipt, name) {
  return parseLogs(contract, receipt).find((p) => p.name === name) || null;
}

/** 便捷方法：取 createEvent 回执里的新 eventId */
export function eventIdFromReceipt(contract, receipt) {
  const log = findLog(contract, receipt, "EventCreated");
  return log ? log.args.eventId : null; // bigint
}

/** 便捷方法：取 claim 回执里的 tokenId（以及 attendee/eventId） */
export function claimFromReceipt(contract, receipt) {
  const log = findLog(contract, receipt, "TicketClaimed");
  if (!log) return null;
  return {
    eventId: log.args.eventId,
    attendee: log.args.attendee,
    tokenId: log.args.tokenId,
  };
}

/**
 * 历史日志：拉取某场活动的领取名单。
 * 注意 receipt.logs 只含「当笔交易」的日志，历史数据要用 queryFilter。
 * 公共 RPC 对 eth_getLogs 的区块区间有限制，活动量大时建议按部署区块分段查。
 */
export async function fetchClaimers(contract, eventId, fromBlock = 0) {
  const filter = contract.filters.TicketClaimed(eventId, null, null);
  const logs = await contract.queryFilter(filter, fromBlock, "latest");
  return logs.map((l) => ({
    eventId: l.args.eventId,
    attendee: l.args.attendee,
    tokenId: l.args.tokenId,
    txHash: l.transactionHash,
  }));
}
