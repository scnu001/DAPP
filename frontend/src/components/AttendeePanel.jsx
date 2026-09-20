import { CONTRACT_ADDRESS } from "../lib/contract";
import { explorerNft } from "../lib/format";

/** 参与者视图：我已领取的门票 */
export default function AttendeePanel({ myTickets, events }) {
  const entries = Object.entries(myTickets || {});
  if (entries.length === 0) return null;

  const nameOf = (id) => {
    const e = events.find((x) => String(x.eventId) === id);
    return e ? e.name : `活动 #${id}`;
  };

  return (
    <section className="panel">
      <h2>我的门票</h2>
      <ul className="ticket-list">
        {entries.map(([eventId, tokenId]) => (
          <li key={eventId}>
            <span>
              {nameOf(eventId)} —— token #{tokenId}
            </span>
            <a
              className="btn btn-outline btn-xs"
              href={explorerNft(CONTRACT_ADDRESS, tokenId)}
              target="_blank"
              rel="noreferrer"
            >
              在 Etherscan 查看
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
