# `wallet-login/` —— 共享钱包模块的演示壳

这个目录**不含任何钱包实现代码**。它只是 [`shared/wallet`](../shared/wallet)（别名 `@wallet`）的一个消费者，
存在的意义有两个：

1. 回答「一个页面要怎么装配这个钱包模块」—— 包一层 `<WalletProvider>`，取状态，放组件；
2. 把 `useWalletContext()` 的**原始输出**打成表格，方便观察状态机怎么跳；
3. 顺带作为**钱包层改动的快速回归入口**（跑一次冒烟几秒钟）。

> 一句话理解：**钱包的实现看 `../shared/wallet/`，本目录只是一个壳 + 一张状态表。**
> 「连接钱包」不等于「登录」—— 没有会话、没有 token，拿到的只是一个公开地址。

---

## 怎么跑

```bash
cd comp7610-ticket-dapp/wallet-login
npm install
npm run dev          # → http://127.0.0.1:5173/
```

打开页面后点右上角「连接钱包」，MetaMask 会弹授权窗；授权后会自动校验 / 切换到 Sepolia。

> ⚠️ 端口刻意锁在 **5173**，和 `../frontend` 一样。代价是**两个项目不能同时启动** ——
> 跑这个之前先把 `../frontend` 的 dev server 关掉。

### 快速回归（不需要 MetaMask）

```bash
cd ../e2e
node smoke-shared-wallet.mjs wallet-login     # 注入假钱包跑 4 个场景，约 15 秒
```

会验证：无钱包 → `noMetaMask`；已连 Sepolia → 连接态；钱包在主网 → 黄条 + 一键切换（并断言真的发出了
`wallet_switchEthereumChain`）；点「断开」→ 断言真的发出了 `wallet_revokePermissions`。
脚本会自己起 / 关 dev server（`e2e/` 不入库）。

真钱包 E2E：

```bash
node e2e/run-wallet-login.mjs     # 转调父仓库的 ../e2e/wallet-login.mjs
```

### 页面锚点约定

页面里有几处**稳定的 class 名与按钮文案**，自动化脚本依赖它们。改 UI 时请一并维护
（它们同时是样式钩子）：

- `.account-addr` —— 连接成功后显示地址（`title` 属性上是**完整**地址，别拿显示的缩略串去比）
- `.network-badge`（`.ok` / `.bad`）—— 网络徽章与状态
- **唯一一条** `.banner-warn`（文案含「当前网络不是 Sepolia」）
- `.inline-error` —— 错误文案
- 按钮文案：「连接钱包」/「断开」/「切换到 Sepolia」

---

## 文件地图

```
wallet-login/
├─ index.html                     入口 HTML（只挂 #root）
├─ vite.config.js                  React 插件 + @wallet 别名 + 端口 5173
├─ package.json                    React 18 / Vite 5 / Ethers 6（与父项目一致）
├─ .env.example                    唯一配置项是可选只读 RPC；本壳其实不需要
├─ e2e/run-wallet-login.mjs       真钱包 E2E（转调父仓库脚本，不复制代码）
└─ src/
   ├─ main.jsx                    挂载 + 引入 @wallet 样式与本地 demo.css
   ├─ App.jsx                     演示页：组装组件 + 打印原始状态
   └─ styles/demo.css             只剩本页用到的 .kv（状态表）与 .notes
```

就这些。钱包层（`useWallet` / `WalletContext` / 两个组件 / `chain` / `errors` / `format` / `wallet.css`）
**全部在 `../shared/wallet/src/`**，本目录一行都没有 —— 这是重构后的设计，避免两份实现漂移。

---

## `useWalletContext()` 的接口

与 `useWallet()` 返回同一个结构，详见 [`../shared/wallet/README.md`](../shared/wallet/README.md)。

```js
const {
  status,        // loading | noMetaMask | disconnected | connecting | connected | wrongNetwork
  account,       // "0x…"，来自 eth_accounts / eth_requestAccounts
  chainId,       // "0xaa36a7" 这样的十六进制字符串，来自 eth_chainId
  provider,      // ethers.BrowserProvider（包装 window.ethereum）
  signer,        // ethers.JsonRpcSigner —— 业务层拿它去发交易，本壳不用
  error,         // 最近一次失败原因（原始 message）
  connect,       // 点「连接钱包」→ eth_requestAccounts（弹窗）
  disconnect,    // 点「断开」→ wallet_revokePermissions（撤销本站授权）
  ensureSepolia, // 静默读链 → 不是 Sepolia 就 switch（4902 时先 add）→ 轮询复核
  isConnected,   // status === "connected"
  isWrongNetwork // status === "wrongNetwork"
} = useWalletContext();
```

状态机：

```
loading ──┬─→ noMetaMask                       页面里没有 window.ethereum
          └─→ disconnected ⇄ connecting ─→ connected ⇄ wrongNetwork
                    ↑                        │
                    └────── disconnect ──────┘
```

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

事件：`accountsChanged`、`chainChanged`。两个监听器在 mount-only effect 里注册、卸载时 `removeListener`
—— **依赖数组必须是 `[]` 类**，否则每次渲染都会重复解绑 / 绑定（很多教程示例就漏了这点）。

---

## 与父项目的关系

| | 路径 | 说明 |
|---|---|---|
| 共享钱包模块 | `../shared/wallet/` | **钱包层的唯一真源**（`useWallet` / Context / 两个组件 / `chain` / `errors` / `format` / `wallet.css`） |
| 本目录 | `.` | 只是它的一层演示壳：`App.jsx` + `main.jsx` + `demo.css` |
| 门票业务 | `../frontend/` | 另一个消费者：在同一个钱包接口之上实现铸造 / 领取 |

**`shared/wallet/` 里改代码，两个项目同时生效**，不存在「同步这一份 / 换回 import」这种事了。
改完记得两边都 `npm run build` 一遍（CI 也是分开跑两个 build）。
