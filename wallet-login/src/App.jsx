/**
 * App.jsx —— 共享钱包模块 `@wallet` 的演示壳。
 *
 * ⚠️ 这里**没有**任何钱包实现代码：useWallet / WalletContext / 两个组件全部来自 `@wallet`。
 *    这个目录存在的意义只有两个：
 *      1) 演示「一个页面要怎么装配钱包模块」—— 包一层 <WalletProvider>，然后取状态、放组件；
 *      2) 把 useWallet 暴露的原始状态打印出来，方便观察状态机怎么跳。
 *
 *    想读钱包的实现，看 `shared/wallet/src/`；想读合约业务，看 `frontend/src/`。
 *
 * 页面上这几个 class / 文案是自动化测试的稳定锚点，改样式可以，改结构或文案请同步更新 README：
 *      .account-addr   连接成功后显示地址
 *      .network-badge  网络徽章（内含「切换到 Sepolia」按钮）
 *      .banner-warn    网络不对时的黄条，文案必须含「当前网络不是 Sepolia」
 *      .inline-error   错误文案
 *      「连接钱包」/「断开」按钮文字
 */
import { WalletProvider, useWalletContext, ConnectWalletButton, NetworkBadge } from "@wallet";

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
            共享模块 <code>@wallet</code> 的演示壳 · 不含任何合约业务 · React 18 + Vite + Ethers v6
          </span>
        </div>
        <div className="header-right">
          <NetworkBadge wallet={wallet} />
          <ConnectWalletButton wallet={wallet} />
        </div>
      </header>

      {/* 网络不对 → 黄条（页面上只保留这一条 .banner-warn） */}
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
          <h2>当前状态（useWalletContext 的原始输出）</h2>
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
                    ← 业务层拿它去 new Contract(...) 发交易；本模块自己不发交易
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
            <li>
              <b>怎么接业务</b>：拿 <code>signer</code> 自己建合约实例即可 ——
              范例见 <code>frontend/src/hooks/useContract.js</code>（门票 DApp 的铸造 / 领取）。
            </li>
          </ul>
        </section>
      </main>

      <footer className="app-footer">
        <span className="muted small">
          共享钱包模块 <code>@wallet</code> · 不含任何合约业务 · 可直接移植到其它项目
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
