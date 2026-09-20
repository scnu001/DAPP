import { friendlyMessage } from "../lib/errors";
import { explorerTx } from "../lib/format";

const LABELS = {
  createEvent: "创建活动",
  claim: "领取门票",
  closeEvent: "关闭活动",
  updateEventURI: "更新元数据地址",
};

/**
 * 写操作状态机：
 *   idle → submitting（钱包确认中）→ pending（已广播，有 hash）→ success / error
 */
export default function TxStatus({ tx, onDismiss }) {
  if (!tx || tx.state === "idle") return null;

  const label = LABELS[tx.label] ?? tx.label ?? "交易";

  return (
    <div className={`tx-status ${tx.state}`}>
      <div className="tx-head">
        <strong>{label}</strong>
        <span className="tx-state">{tx.state}</span>
        {onDismiss ? (
          <button className="btn btn-ghost btn-xs" onClick={onDismiss}>
            关闭
          </button>
        ) : null}
      </div>

      {tx.state === "submitting" ? <p>请在 MetaMask 中确认这笔交易…</p> : null}

      {tx.state === "pending" ? (
        <p>
          交易已广播，等待链上确认…
          {tx.hash ? (
            <>
              {" "}
              <a href={explorerTx(tx.hash)} target="_blank" rel="noreferrer">
                在 Etherscan 查看
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {tx.state === "success" ? (
        <p>
          成功 🎉{" "}
          {tx.hash ? (
            <a href={explorerTx(tx.hash)} target="_blank" rel="noreferrer">
              查看交易
            </a>
          ) : null}
        </p>
      ) : null}

      {tx.state === "error" ? (
        <p className="tx-error">
          {friendlyMessage(tx.reason)}
          {tx.hash ? (
            <>
              {" "}
              <a href={explorerTx(tx.hash)} target="_blank" rel="noreferrer">
                查看交易
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
