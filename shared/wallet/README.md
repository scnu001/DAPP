# 共享钱包模块 `@wallet`

本项目里**唯一**的钱包实现。`frontend/`（门票业务）与 `wallet-login/`（演示壳）通过 Vite 别名
`@wallet` 引用**同一份源码**，所以不存在「两份拷贝漂移」的问题。

> 一句话理解它：它做的事是**读写 `window.ethereum`**，对外产出
> `{ status, account, chainId, provider, signer, error }`。
> 「连接钱包」不等于「登录」—— 没有会话、没有 token，拿到的只是一个公开地址。

---

## 它做什么 / 不做什么

| | |
|---|---|
| **做** | 读写 `window.ethereum`、维护连接状态机、监听 `accountsChanged` / `chainChanged`、自动切到 Sepolia、提供两个现成组件与一套设计 token |
| **不做** | 不加载任何合约 ABI、不发交易、不认识合约地址、不调后端、不产生 token |

判断标准很简单：在这个目录里搜 `claim` / `createEvent` / `TicketNFT` / `ABI`，**应该一条都搜不到**。

---

## 怎么用（3 步）

**第 1 步：配别名**（各项目自己的 `vite.config.js`）

```js
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@wallet": fileURLToPath(new URL("../shared/wallet/src", import.meta.url)) },
  },
});
```

> 用 `fileURLToPath` 而不是 `new URL().pathname`：中文路径下 `pathname` 会带 `%E4%BD%9C` 这类编码，
> 别名会解析不到。

**第 2 步：根部包一层 `<WalletProvider>`**

```jsx
import { WalletProvider } from "@wallet";

export default function App() {
  return (
    <WalletProvider>
      <Page />
    </WalletProvider>
  );
}
```

**第 3 步：页面里取状态、放组件**

```jsx
import { useWalletContext, ConnectWalletButton, NetworkBadge } from "@wallet";

function Page() {
  const wallet = useWalletContext();
  return (
    <header>
      <NetworkBadge wallet={wallet} />
      <ConnectWalletButton wallet={wallet} />
    </header>
  );
}
```

样式（可选，但推荐 —— 保证与其它项目视觉一致）：

```css
/* 放在项目自己 CSS 的第一行 */
@import "@wallet/styles/wallet.css";
```

---

## 公开接口

**唯一的公开入口是 `src/index.js`。** 消费方只允许：

```js
import { … } from "@wallet";
```

不要写 `@wallet/hooks/useWallet` 这类深层路径 —— 那是内部实现，随时可能改。

### A. React 装配

| 导出 | 说明 |
|---|---|
| `WalletProvider` | `({ children })`。在页面根部包一层，把钱包状态注入 Context。一个页面只包一次。 |
| `useWalletContext()` | 取 Context 里的钱包对象；不在 Provider 内会抛错（尽早暴露装配错误）。**常规用法。** |
| `useWallet()` | 不走 Context，每次调用新建一份状态。需要多个独立钱包实例时用（少见）。 |

### B. 现成组件（都只吃一个 `wallet` prop，自己绝不碰 `window.ethereum`）

| 导出 | 说明 |
|---|---|
| `ConnectWalletButton` | 按 `status` 渲染「连接钱包 / 断开」或「安装 MetaMask」。锚点：`.account-addr`（`title` 上是完整地址）、`.inline-error`。 |
| `NetworkBadge` | 显示当前网络；非 Sepolia 时给「切换到 Sepolia (0xaa36a7)」按钮。锚点：`.network-badge` / `.network-badge.ok` / `.network-badge.bad`。 |

### C. 钱包状态对象（`useWallet()` / `useWalletContext()` 的返回值）

```js
const {
  status,          // "loading" | "noMetaMask" | "disconnected" | "connecting" | "connected" | "wrongNetwork"
  account,         // "0x…"；未连接为 ""
  chainId,         // 十六进制字符串，如 "0xaa36a7"
  provider,        // ethers.BrowserProvider | null
  signer,          // ethers.JsonRpcSigner | null   ← 业务层拿它 new Contract(...) 发交易
  error,           // 原始失败 message；无错误为 ""
  connect,         // () => Promise<void>   点「连接钱包」→ eth_requestAccounts（弹窗）
  disconnect,      // () => Promise<void>   点「断开」→ wallet_revokePermissions（静默）
  ensureSepolia,   // () => Promise<void>   幂等：不是 Sepolia 就切（4902 时先 add）→ 轮询复核
  isConnected,     // status === "connected"
  isWrongNetwork,  // status === "wrongNetwork"
} = useWalletContext();
```

状态机：

```
loading ──┬─→ noMetaMask                       页面里没有 window.ethereum
          └─→ disconnected ⇄ connecting ─→ connected ⇄ wrongNetwork
                    ↑                        │
                    └────── disconnect ──────┘
```

### D. 链常量（**想换链只改 `src/lib/chain.js`**）

| 导出 | 值 / 说明 |
|---|---|
| `SEPOLIA_CHAIN_ID` | `"0xaa36a7"` —— EIP-3326 要求的十六进制形式 |
| `SEPOLIA_CHAIN_ID_DEC` | `11155111` |
| `SEPOLIA_RPC_URL` | 公共只读 RPC；可用 `VITE_SEPOLIA_RPC_URL` 覆盖 |
| `SEPOLIA_EXPLORER_URL` | `https://sepolia.etherscan.io` |
| `SEPOLIA_NETWORK_PARAMS` | `wallet_addEthereumChain` 的参数（处理 4902 时用） |

### E. 无状态助手

| 导出 | 签名 | 说明 |
|---|---|---|
| `isSepolia` | `(chainId) => boolean` | 容忍 `string` / `number` / `bigint` 与大小写（事件给 hex 串、`getNetwork()` 给 bigint，严格比较会漏判）。 |
| `isUserRejection` | `(err) => boolean` | 是不是「用户在钱包里点了拒绝」（code 4001 或文案命中）。 |
| `codeOf` | `(err) => number / null` | 从 `err.code` / `err.error.code` / `err.info.error.code` 挖出 EIP-1193 错误码。 |
| `friendlyWalletError` | `(err) => string` | 错误码 → 用户拒绝文案 → Ethers `shortMessage` → 原始 `message`（超 160 字符截断）。**不含合约 revert。** |
| `shortAddress` | `(addr) => string` | `0x1234…abcd` |
| `explorerAddress` | `(addr) => string` | Etherscan 地址页链接（只拼 URL，不发请求） |

内置 EIP-1193 错误码表：`4001` 用户取消 / `4100` 未授权 / `4200` 不支持该方法 /
`4900` 与节点断开 / `4901` 未连接该网络 / `4902` 钱包里没有 Sepolia（触发 add）。

---

## 用到了哪些 EIP-1193 方法

| 方法 | 何时调用 | 弹不弹窗 |
|---|---|---|
| `eth_accounts` | 挂载时静默恢复上次授权 | 不弹 |
| `eth_requestAccounts` | 点「连接钱包」 | **弹** |
| `eth_chainId` | 每次要判断网络前静默读一次 | 不弹 |
| `wallet_switchEthereumChain` | 网络不对时切 Sepolia | **弹** |
| `wallet_addEthereumChain` | 上面的报 4902（钱包里没这条链）时补一次 | **弹** |
| `wallet_revokePermissions` | 点「断开」 | 不弹（部分钱包不支持，已 try/catch 吞掉） |

事件：`accountsChanged`（换账号 / 钱包锁定）、`chainChanged`（换网络）。
两个监听器在 mount-only effect 里注册、卸载时 `removeListener` —— **依赖数组必须是 `[]` 类**，
否则每次渲染都会重复解绑 / 绑定（很多教程示例就漏了这点）。

> ⚠️ `wallet_switchEthereumChain` 的 Promise 语义不可靠（部分版本提前 resolve 或抛 `-32603`），
> 所以切完链会**轮询复核**最多 3 秒，不信 Promise 的返回值。

---

## 接业务：拿 `signer` 自己建合约

**不要**往这个目录里加合约代码。正确做法是在上层再包一层，把 `provider` / `signer` 往下传。
本项目的范例是 `frontend/src/hooks/useContract.js`：

```js
import { Contract, JsonRpcProvider } from "ethers";
import { SEPOLIA_RPC_URL } from "@wallet";           // 链常量从钱包模块拿
import { CONTRACT_ADDRESS, TICKET_ABI } from "../lib/contract";  // ABI 属于业务

export function useContract(wallet) {
  const readProvider = wallet.provider ?? new JsonRpcProvider(SEPOLIA_RPC_URL);
  const readContract  = new Contract(CONTRACT_ADDRESS, TICKET_ABI, readProvider);
  const writeContract = wallet.signer ? new Contract(CONTRACT_ADDRESS, TICKET_ABI, wallet.signer) : null;
  return { readProvider, readContract, writeContract };
}
```

好处：**换合约不用动钱包模块，换钱包不用动合约代码**。
`readProvider` 有公共 RPC 兜底，所以**没连钱包也能只读浏览**；`writeContract` 没有 signer 时是 `null`，
UI 据此禁用写按钮。

---

## 换链

只改 `src/lib/chain.js` 的 `SEPOLIA_*` 四个常量（以及 `SEPOLIA_NETWORK_PARAMS`）。
`useWallet.js`、两个组件、`errors.js` 里都没有写死的链信息。

---

## 移植到别的项目

**整目录复制** `shared/wallet/`（现在它是一整个自包含模块），然后：

1. 在新项目的 `vite.config.js` 里把 `@wallet` 别名指过去；
2. 装依赖 `ethers@^6` + `react@^18`；
3. 根节点包 `<WalletProvider>`，页面里 `useWalletContext()` 取状态；
4. 想统一视觉就 `@import "@wallet/styles/wallet.css";`。

四步之后就能用了。要接自己的合约，照上面「接业务」那段包一层即可。

---

## 几个容易被问到的点

- **为什么刷新页面不会重新弹窗？** 因为钱包那边「站点授权」还在，`eth_accounts` 直接返回地址。
  这不是前端做的持久化 —— 前端没有任何 token / localStorage 登录态。
- **每次交易都要重新「连接钱包」吗？** 不用。连接（授权站点）一个来源只做一次；
  每笔**写操作**需要的是**当次签名确认**（钱包弹窗点确认），那是签名，不是连接。
- **`signer` 是干嘛的？** 它是 ethers 对「能签名的账户」的包装。本模块只负责把它取出来，
  自己不使用 —— 那是给上层业务留的接口。
- **为什么 `window.ethereum` 只允许出现在一个文件里？** 因为它是全局单例 + 事件源，
  多处直接访问必然出现重复监听、状态不同步。集中一处之后，「换钱包」（MetaMask → WalletConnect → …）
  只需要改这一个文件。
- **能不能不做网络检查？** 可以，但写操作会打到错误的链上。`ensureSepolia()` 在连接成功后自动跑一次，
  失败就把状态压成 `wrongNetwork`，由 `NetworkBadge` 给出「一键切换」。
- **为什么用 `BrowserProvider` 而不是 `Web3Provider`？** Ethers v6 里 `Web3Provider` 已改名 `BrowserProvider`。
