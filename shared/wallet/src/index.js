/**
 * shared/wallet —— 独立钱包模块的**唯一公开入口**。
 *
 * 约定：
 *   1. 消费方只允许 `import { ... } from "@wallet"`（Vite alias 指向本文件所在目录）。
 *      不要写 `@wallet/hooks/useWallet` 这类深层路径 —— 那是内部实现，随时可能改。
 *   2. 模块只做「钱包」这一件事：连接状态、账号、链、signer，
 *      以及自动切到 Sepolia。它不认识任何合约、ABI、后端接口。
 *   3. 要发交易/调合约，消费方拿 `signer`（或 `provider`）自己 `new Contract(...)` ——
 *      见 frontend/src/hooks/useContract.js，那就是「业务层基于钱包接口实现」的范例。
 *
 * ── 公开接口（共 5 组） ────────────────────────────────────────────────
 *
 * A. React 装配
 *      WalletProvider          // 根节点包一层，注入钱包状态
 *      useWalletContext()      // 任意子组件取钱包；必须在 Provider 内
 *      useWallet()             // 不走 Context，直接用（需要多实例时）
 *
 * B. 现成组件（都只吃一个 `wallet` prop）
 *      ConnectWalletButton     // 「连接钱包 / 断开」；锚点 .account-addr
 *      NetworkBadge            // 网络徽章 + 「切换到 Sepolia」；锚点 .network-badge
 *
 * C. 钱包状态对象（useWallet / useWalletContext 的返回值）
 *      status       "loading" | "noMetaMask" | "disconnected" | "connecting"
 *                   | "connected" | "wrongNetwork"
 *      account      string   当前地址（未连接时 ""）
 *      chainId      string   十六进制，如 "0xaa36a7"
 *      provider     BrowserProvider | null
 *      signer       JsonRpcSigner | null      ← 业务层拿它去发交易
 *      error        string   最近一次失败原因（原始 message）
 *      connect()              eth_requestAccounts，弹授权窗
 *      disconnect()           wallet_revokePermissions，撤掉本站授权
 *      ensureSepolia()        幂等：不在 Sepolia 就切换/添加（可能弹窗）
 *      isConnected            boolean  status === "connected"
 *      isWrongNetwork         boolean  status === "wrongNetwork"
 *
 * D. 链常量                      — 想换链只改 lib/chain.js
 *      SEPOLIA_CHAIN_ID / SEPOLIA_CHAIN_ID_DEC / SEPOLIA_RPC_URL
 *      SEPOLIA_EXPLORER_URL / SEPOLIA_NETWORK_PARAMS
 *
 * E. 无状态助手
 *      isSepolia(chainId)      容忍 hex 字符串 / number / bigint
 *      isUserRejection(err)    是不是用户在钱包里点了拒绝
 *      friendlyWalletError(err) 钱包层错误 → 中文（不含合约 revert，那是业务层的事）
 *      shortAddress(addr) / explorerAddress(addr)
 *
 * F. 样式
 *      @import "@wallet/styles/wallet.css";   // 在项目自己的 CSS 顶部引入
 */

/* A. React 装配 */
export { WalletProvider, useWalletContext } from "./context/WalletContext.jsx";
export { useWallet } from "./hooks/useWallet.js";

/* B. 现成组件 */
export { default as ConnectWalletButton } from "./components/ConnectWalletButton.jsx";
export { default as NetworkBadge } from "./components/NetworkBadge.jsx";

/* D. 链常量 */
export {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID_DEC,
  SEPOLIA_RPC_URL,
  SEPOLIA_EXPLORER_URL,
  SEPOLIA_NETWORK_PARAMS,
} from "./lib/chain.js";

/* E. 无状态助手 */
export { isSepolia, isUserRejection, friendlyWalletError, codeOf } from "./lib/errors.js";
export { shortAddress, explorerAddress } from "./lib/format.js";
