/**
 * App.jsx —— 钱包登录模块的独立演示页。
 *
 * 与门票 DApp 的 App.jsx 的区别：这里**没有** useContract / useEvents / 任何合约面板。
 * 页面只做两件事：
 *   1) 组装真实组件（NetworkBadge + ConnectWalletButton），跟原项目里的用法一模一样；
 *   2) 把 useWallet 暴露的原始状态打印出来，方便观察状态机怎么跳。
 *
 * ⚠️ 页面上这几个 class 是 e2e/wallet-login.mjs 依赖的契约，改样式可以、改结构要同步改脚本：
 *      .account-addr   连接成功后显示地址
 *      .network-badge  网络徽章（内含「切换到 Sepolia」按钮）
 *      .banner-warn    网络不对时的黄条
 *      .inline-error   错误文案
 *      「连接钱包」/「断开」按钮文字
 */
import { WalletProvider, useWalletContext } from "./context/WalletContext";
import ConnectWalletButton from "./components/ConnectWalletButton";
import NetworkBadge from "./components/NetworkBadge";

const STATUS_LABEL = {
  loading: "loading · 正在静默询问钱包（eth_accounts）",
  noMetaMask: "noMetaMask · 页面里没有 window.ethereum",
  disconnected: "disconnected · 未连接（本站未获授权）",
  connecting: "connecting · 已发出 eth_requestAccounts，等你在钱包里确认",
  connected: "connected · 已连接，且网络正确",
  wrongNetwork: "wrongNetwork · 已连接，但网络不是 Sepolia",
};

function Demo() {
  const wallet = useWalletContext();
  const { status, account, chainId, provider, signer, error } = wallet;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>钱包登录模块</h1>
          <span className="muted small">
            独立抽出 · 不含任何合约业务 · React 18 + Vite + Ethers v6
          </span>
        </div>
        <div className="header-right">
          <NetworkBadge wallet={wallet} />
          <ConnectWalletButton wallet={wallet} />
        </div>
      </header>

      {/* 网络不对 → 黄条（e2e 用 .banner-warn + "当前网络不是 Sepolia" 定位，文案别改） */}
      {status === "wrongNetwork" ? (
        <div className="banner banner-warn">
          当前网络不是 Sepolia（0xaa36a7）。点右上角「切换到 Sepolia」发起切换，或在 MetaMask
          里手动切。
        </div>
      ) : null}

      {status === "disconnected" ? (
        <div className="banner">
          未连接钱包 —— 点右上角「连接钱包」发起授权（这一步会弹出 MetaMask 窗口）。
        </div>
      ) : null}

      <main className="app-main">
        <section className="panel">
          <h2>当前状态（useWallet 的原始输出）</h2>
          <table className="kv">
            <tbody>
              <tr>
                <th>status</th>
                <td>
                  <code>{STATUS_LABEL[status] ?? status}</code>
                </td>
              </tr>
              <tr>
                <th>account</th>
                <td>
                  <code>{account || "（空）"}</code>
                  <span className="muted small"> ← 来自 eth_accounts / eth_requestAccounts</span>
                </td>
              </tr>
              <tr>
                <th>chainId</th>
                <td>
                  <code>{chainId || "（空）"}</code>
                  <span className="muted small"> ← 来自 eth_chainId，十六进制字符串</span>
                </td>
              </tr>
              <tr>
                <th>provider</th>
                <td>
                  <code>{provider ? "BrowserProvider 实例" : "null"}</code>
                  <span className="muted small"> ← ethers 包装 window.ethereum</span>
                </td>
              </tr>
              <tr>
                <th>signer</th>
                <td>
                  <code>{signer ? "JsonRpcSigner 实例" : "null"}</code>
                  <span className="muted small">
                    {" "}
                    ← 只用来发交易签名；本模块不做任何交易
                  </span>
                </td>
              </tr>
              <tr>
                <th>error</th>
                <td>
                  {error ? <span className="inline-error">{error}</span> : <code>（无）</code>}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>这个模块做了什么 / 没做什么</h2>
          <ul className="notes">
            <li>
              <b>做</b>：读写 <code>window.ethereum</code>、维护连接状态机、监听{" "}
              <code>accountsChanged</code> / <code>chainChanged</code>、自动切到 Sepolia。
            </li>
            <li>
              <b>不做</b>：不加载合约 ABI、不发交易、不调后端、不产生任何 token。
              「连接钱包」只是拿到一个公开地址，不是登录鉴权。
            </li>
            <li>
              刷新页面不弹窗：靠 <code>eth_accounts</code> 静默恢复（钱包里的站点授权还在）。
            </li>
            <li>
              「断开」实际调的是 <code>wallet_revokePermissions</code>，撤销本站授权 ——
              MetaMask 没有真正的 disconnect 接口。
            </li>
          </ul>
        </section>
      </main>

      <footer className="app-footer">
        <span className="muted small">
          独立钱包模块 · 完整交互验证见 <code>e2e/run-wallet-login.mjs</code>
        </span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <Demo />
    </WalletProvider>
  );
}
