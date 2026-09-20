import { shortAddress, explorerAddress } from "../lib/format";

export default function ConnectWalletButton({ wallet }) {
  const { status, account, error, connect, disconnect } = wallet;

  if (status === "noMetaMask") {
    return (
      <a
        className="btn btn-primary"
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
      >
        安装 MetaMask
      </a>
    );
  }

  if (status === "connecting") {
    return (
      <button className="btn btn-primary" disabled>
        连接中…
      </button>
    );
  }

  if (!account) {
    return (
      <button className="btn btn-primary" onClick={connect}>
        连接钱包
      </button>
    );
  }

  return (
    <div className="account-box">
      <a
        className="account-addr"
        href={explorerAddress(account)}
        target="_blank"
        rel="noreferrer"
        title={account}
      >
        {shortAddress(account)}
      </a>
      <button className="btn btn-ghost" onClick={disconnect} title="撤销本站授权">
        断开
      </button>
      {error ? <span className="inline-error">{error}</span> : null}
    </div>
  );
}
