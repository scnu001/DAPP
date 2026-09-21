import { useState } from "react";
// 钱包层全部来自共享模块（单一真源）—— 连接、账号、链、signer 都从 @wallet 拿。
// 本文件以下的部分才是业务：把 signer 变成 TicketNFT 合约调用，做铸造与领取。
import {
  WalletProvider,
  useWalletContext,
  ConnectWalletButton,
  NetworkBadge,
} from "@wallet";
import { useContract } from "./hooks/useContract";
import { useEvents } from "./hooks/useEvents";
import OrganizerPanel from "./components/OrganizerPanel";
import AttendeePanel from "./components/AttendeePanel";
import EventCard from "./components/EventCard";
import TxStatus from "./components/TxStatus";
import { CONTRACT_ADDRESS } from "./lib/contract";
import { explorerContract, shortAddress } from "./lib/format";

function Dapp() {
  const wallet = useWalletContext();
  // 钱包接口 → 合约实例：readContract 用公共 RPC 兜底，writeContract 需要 signer
  const { readContract, writeContract } = useContract(wallet);
  const ticket = useEvents({ wallet, readContract, writeContract });

  const [busyId, setBusyId] = useState(null);
  const [busy, setBusy] = useState(false);

  // 写操作的硬门槛：已连接 + 在 Sepolia + 有 signer
  const canWrite = Boolean(writeContract) && wallet.status === "connected";

  const guard = async (fn, id) => {
    id ? setBusyId(id) : setBusy(true);
    try {
      return await fn();
    } catch {
      /* 失败原因已经写进 ticket.tx，由 TxStatus 展示 */
      return null;
    } finally {
      id ? setBusyId(null) : setBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>Ticket DApp</h1>
          <span className="muted small">
            合约{" "}
            {CONTRACT_ADDRESS ? (
              <a href={explorerContract(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
                {shortAddress(CONTRACT_ADDRESS)}
              </a>
            ) : (
              "未配置"
            )}
          </span>
        </div>
        <div className="header-right">
          <NetworkBadge wallet={wallet} />
          <ConnectWalletButton wallet={wallet} />
        </div>
      </header>

      {!CONTRACT_ADDRESS ? (
        <div className="banner banner-warn">
          未配置合约地址：把部署后的地址写进 <code>frontend/.env</code> 的{" "}
          <code>VITE_CONTRACT_ADDRESS</code> 再重启 <code>npm run dev</code>。
        </div>
      ) : null}

      {wallet.status === "wrongNetwork" ? (
        <div className="banner banner-warn">
          当前网络不是 Sepolia（0xaa36a7），写操作已禁用。请点上方「切换到 Sepolia」或在 MetaMask
          里手动切换。
        </div>
      ) : null}

      {wallet.status === "disconnected" || wallet.status === "loading" ? (
        <div className="banner">
          未连接钱包 —— 仍然可以用只读 RPC 浏览活动列表；领取门票需要先连接钱包。
        </div>
      ) : null}

      <main className="app-main">
        <OrganizerPanel
          isOrganizer={ticket.isOrganizer}
          canWrite={canWrite}
          busy={busy}
          onCreate={(form) => guard(() => ticket.createEvent(form))}
        />

        <AttendeePanel myTickets={ticket.myTickets} events={ticket.events} />

        <section className="panel">
          <div className="panel-head">
            <h2>活动列表（链上只读）</h2>
            <button className="btn btn-ghost btn-xs" onClick={ticket.refresh} disabled={ticket.loading}>
              {ticket.loading ? "刷新中…" : "刷新"}
            </button>
          </div>

          {ticket.loadError ? <div className="banner banner-error">{ticket.loadError}</div> : null}

          {ticket.events.length === 0 && !ticket.loading ? (
            <p className="muted">还没有活动。用部署合约的账户连接钱包，即可创建第一场活动。</p>
          ) : null}

          <div className="card-grid">
            {ticket.events.map((e) => (
              <EventCard
                key={e.eventId}
                event={e}
                myTokenId={ticket.myTickets[String(e.eventId)]}
                isOrganizer={ticket.isOrganizer}
                canWrite={canWrite}
                busy={busyId === e.eventId}
                onClaim={(id) => guard(() => ticket.claim(id), id)}
                onClose={(id) => guard(() => ticket.closeEvent(id), id)}
              />
            ))}
          </div>
        </section>
      </main>

      <TxStatus tx={ticket.tx} onDismiss={() => ticket.setTx({ state: "idle" })} />

      <footer className="app-footer">
        <span className="muted small">
          钱包层来自共享模块 <code>@wallet</code> · 业务层 React 18 + Vite · Ethers v6 · Solidity
          ^0.8.20 + OpenZeppelin v5 · Sepolia
        </span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <Dapp />
    </WalletProvider>
  );
}
