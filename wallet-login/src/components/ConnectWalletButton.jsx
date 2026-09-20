/**
 * ConnectWalletButton —— 「连接钱包 / 断开」按钮。
 * 与原项目逐字一致，唯一依赖是把 shortAddress/explorerAddress 从 ../lib/format 取。
 *
 * 组件本身不含任何逻辑：它只是按 status 分支渲染，真正的动作都在 useWallet 里。
 *   noMetaMask  → 引导安装
 *   connecting  → 禁用态，等钱包弹窗
 *   无 account  → 「连接钱包」（触发 eth_requestAccounts）
 *   有 account  → 显示缩略地址 + 「断开」（wallet_revokePermissions）
 */
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
