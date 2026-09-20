import { explorerAddress, explorerNft, formatTime, shortAddress } from "../lib/format";
import { CONTRACT_ADDRESS } from "../lib/contract";

function statusOf(e, myTokenId, now) {
  if (!e.open) return { key: "closed", text: "已关闭", claimable: false };
  if (e.startAt && now < e.startAt) return { key: "waiting", text: "未开始", claimable: false };
  if (e.endAt && now > e.endAt) return { key: "ended", text: "已结束", claimable: false };
  if (e.minted >= e.maxSupply) return { key: "soldout", text: "已领完", claimable: false };
  if (myTokenId) return { key: "owned", text: "已领取", claimable: false };
  return { key: "open", text: "可领取", claimable: true };
}

export default function EventCard({
  event,
  myTokenId,
  isOrganizer,
  canWrite,
  busy,
  onClaim,
  onClose,
}) {
  const now = Math.floor(Date.now() / 1000);
  const st = statusOf(event, myTokenId, now);
  const pct = event.maxSupply ? Math.round((event.minted / event.maxSupply) * 100) : 0;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>
            #{event.eventId} {event.name || "(未命名)"}
          </h3>
          <p className="muted">
            主办方{" "}
            <a href={explorerAddress(event.organizer)} target="_blank" rel="noreferrer">
              {shortAddress(event.organizer)}
            </a>
          </p>
        </div>
        <span className={`tag tag-${st.key}`}>{st.text}</span>
      </div>

      <div className="progress">
        <div className="progress-bar" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="muted small">
        已领 {event.minted} / {event.maxSupply} · 开始 {formatTime(event.startAt)} · 结束{" "}
        {formatTime(event.endAt)}
      </p>

      <div className="card-actions">
        {myTokenId ? (
          <a
            className="btn btn-outline"
            href={explorerNft(CONTRACT_ADDRESS, myTokenId)}
            target="_blank"
            rel="noreferrer"
          >
            我的门票 #{myTokenId}（Etherscan）
          </a>
        ) : (
          <button
            className="btn btn-primary"
            disabled={!canWrite || !st.claimable || busy}
            onClick={() => onClaim(event.eventId)}
            title={!canWrite ? "请先连接钱包并切换到 Sepolia" : ""}
          >
            {busy ? "处理中…" : "领取门票"}
          </button>
        )}

        {isOrganizer && event.open ? (
          <button className="btn btn-danger" disabled={!canWrite || busy} onClick={() => onClose(event.eventId)}>
            关闭活动
          </button>
        ) : null}
      </div>
    </div>
  );
}
