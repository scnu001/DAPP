/**
 * useEvents —— 活动数据（只读）+ 三个写操作（createEvent / claim / closeEvent）。
 *
 * 写操作统一走 runTx：
 *   submitting（钱包确认中）→ pending（拿到 hash）→ success（receipt，解析事件） / error（revert 原因）
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAddress } from "ethers";
import { decodeRevert } from "../lib/errors";
import { findLog } from "../lib/events";

export function useEvents({ wallet, readContract, writeContract }) {
  const [events, setEvents] = useState([]);
  const [owner, setOwner] = useState("");
  const [myTickets, setMyTickets] = useState({}); // { [eventId]: tokenId(string) }
  const [tx, setTx] = useState({ state: "idle" });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const account = wallet.account;

  /** 角色由链上 owner() 推导，不是用户在 UI 上选的 */
  const isOrganizer = useMemo(() => {
    if (!owner || !account) return false;
    try {
      return getAddress(owner) === getAddress(account); // 必须归一化，否则大小写会误判
    } catch {
      return false;
    }
  }, [owner, account]);

  const refresh = useCallback(async () => {
    if (!readContract) return;
    setLoading(true);
    setLoadError("");
    try {
      const [count, ownerAddr] = await Promise.all([
        readContract.eventCount(),
        readContract.owner(),
      ]);
      const n = Number(count);
      const ids = Array.from({ length: n }, (_, i) => i + 1);

      const raws = await Promise.all(ids.map((id) => readContract.getEventInfo(id)));
      const list = raws.map((e, i) => ({
        eventId: ids[i],
        name: e.name,
        baseURI: e.baseURI,
        startAt: Number(e.startAt),
        endAt: Number(e.endAt),
        maxSupply: Number(e.maxSupply),
        minted: Number(e.minted),
        open: Boolean(e.open),
        organizer: e.organizer,
      }));
      list.reverse(); // 新活动在前
      setEvents(list);
      setOwner(ownerAddr);

      if (account && n > 0) {
        const tokens = await Promise.all(
          ids.map((id) => readContract.ticketOf(id, account))
        );
        const map = {};
        ids.forEach((id, i) => {
          const t = tokens[i];
          if (t && t !== 0n) map[String(id)] = t.toString(); // bigint -> string
        });
        setMyTickets(map);
      } else {
        setMyTickets({});
      }
    } catch (err) {
      setLoadError(err?.shortMessage ?? err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [readContract, account]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  /** 统一的写操作包装：ensureSepolia → send → wait → 刷新数据 → 解析错误 */
  const runTx = useCallback(
    async (label, send) => {
      if (!writeContract) throw new Error("请先连接钱包");
      await wallet.ensureSepolia(); // 幂等：已在本网就立刻返回

      setTx({ state: "submitting", label });
      try {
        const response = await send();
        setTx({ state: "pending", label, hash: response.hash });

        const receipt = await response.wait(1);
        if (!receipt || receipt.status !== 1) {
          throw new Error("交易已上链但执行失败（reverted）");
        }

        setTx({ state: "success", label, hash: response.hash, receipt });
        await refresh();
        return receipt;
      } catch (err) {
        const reason = decodeRevert(err, writeContract?.interface);
        setTx({
          state: "error",
          label,
          reason,
          hash: err?.transaction?.hash ?? err?.hash ?? "",
        });
        throw err;
      }
    },
    [writeContract, wallet, refresh]
  );

  /** 创建活动：新 eventId 只能从 EventCreated 事件里解析出来 */
  const createEvent = useCallback(
    async (form) => {
      const startAt = Number(form.startAt || 0);
      const endAt = Number(form.endAt || 0);
      const receipt = await runTx("createEvent", () =>
        writeContract.createEvent(
          form.name,
          form.baseURI || "",
          startAt,
          endAt,
          Number(form.maxSupply)
        )
      );
      const log = findLog(writeContract, receipt, "EventCreated");
      return log ? log.args.eventId : null; // bigint
    },
    [runTx, writeContract]
  );

  /** 领取门票：tokenId 从 TicketClaimed 事件里取 */
  const claim = useCallback(
    async (eventId) => {
      const receipt = await runTx("claim", () => writeContract.claim(eventId));
      const log = findLog(writeContract, receipt, "TicketClaimed");
      return log ? { tokenId: log.args.tokenId, eventId: log.args.eventId } : null;
    },
    [runTx, writeContract]
  );

  const closeEvent = useCallback(
    async (eventId) => {
      await runTx("closeEvent", () => writeContract.closeEvent(eventId));
    },
    [runTx, writeContract]
  );

  const updateEventURI = useCallback(
    async (eventId, baseURI) => {
      await runTx("updateEventURI", () => writeContract.updateEventURI(eventId, baseURI));
    },
    [runTx, writeContract]
  );

  return {
    events,
    owner,
    myTickets,
    isOrganizer,
    tx,
    loading,
    loadError,
    refresh,
    createEvent,
    claim,
    closeEvent,
    updateEventURI,
    setTx,
  };
}
