# 钱包登录模块（独立版）

从 COMP7610 门票 DApp（`../frontend`）里**只把「连接钱包」这一层抽出来**的可独立运行项目。
不含任何合约 ABI、不发交易、不调后端、不产生 token —— 就是一个干净的「连接钱包 + 网络管理」模块。

> 一句话理解它：它做的事是**读写 `window.ethereum`**，产出 `{ account, chainId, provider, signer, status }`。
> 「连接钱包」不等于「登录」——没有会话、没有 token，拿到的只是一个公开地址。

---

## 怎么跑

```bash
cd comp7610-ticket-dapp/wallet-login
npm install
npm run dev          # → http://127.0.0.1:5173/
```

打开页面后点右上角「连接钱包」，MetaMask 会弹授权窗；授权后会自动校验/切换到 Sepolia。

> ⚠️ 端口刻意锁在 **5173**，和 `../frontend` 一样。代价是**两个项目不能同时启动** ——
> 跑这个之前先把 `../frontend` 的 dev server 关掉。

### 真钱包端到端验证（开发期做过，脚本未随仓库分发）

开发时用 Playwright 驱动**真实系统 Edge + MetaMask 13.49 扩展**对本项目的页面跑过一轮完整验证。
脚本依赖仓库外的 MetaMask 扩展目录与特定版本的浏览器，按团队约定**不随仓库分发**
（原因见根目录 `README.md` 的 FAQ 第 11 条），这里只留结论：

| # | 检查项 | 结果 |
|---|---|---|
| 0 | 全新 profile onboarding（导入助记词） | ✅ |
| 1 | 点「连接钱包」→ 真实授权弹窗 | ✅ |
| 2 | 连接时自动校验/切到 Sepolia | ✅ Sepolia |
| 3 | 刷新页面 → `eth_accounts` 静默恢复（不弹窗） | ✅ |
| 4 | 钱包切主网 → `chainChanged` → 点按钮一键切回 | ✅ |
| 5 | 钱包换账号 → 断开 → 重连 → 前端地址更新 | ✅ |

**6/6 全绿，退出码 0，耗时 128 秒。**（同一轮也验证过 `../frontend` 的完整铸造链路 5/5。）

页面之所以能被那套断言脚本驱动，是因为 `App.jsx` 保留了下面这几个**稳定锚点**。
改 UI 时请一起维护，否则自动化断言会失效（而且很容易被 `catch` 静默吞掉、变成假通过）：

- `.account-addr` —— 连接成功后显示地址
- `.network-badge` —— 网络徽章
- **唯一一条** `.banner-warn`（文案含「当前网络不是 Sepolia」）
- `.inline-error` —— 错误文案
- 按钮文案：「连接钱包」/「断开」/「切换到 Sepolia」

---

## 文件地图

```
wallet-login/
├─ index.html                     入口 HTML（只挂 #root）
├─ vite.config.js                 React 插件 + 端口 5173
├─ package.json                   React 18 / Vite 5 / Ethers 6（与大项目完全一致）
├─ .env.example                   唯一的配置项是可选只读 RPC；本模块其实不需要
└─ src/
   ├─ main.jsx                    挂载 + 引入样式
   ├─ App.jsx                     演示页：组装组件 + 打印 useWallet 的原始状态
   ├─ styles/wallet.css           只摘出钱包相关的 CSS（.btn* / .account-* / .network-badge / .banner*）
   ├─ context/WalletContext.jsx   把 useWallet 的状态挂到 Context，免 props 透传
   ├─ components/
   │  ├─ ConnectWalletButton.jsx   「连接钱包 / 断开」按钮（纯展示）
   │  └─ NetworkBadge.jsx          网络徽章 + 「切换到 Sepolia」（纯展示）
   ├─ hooks/useWallet.js          ★ 核心：唯一碰 window.ethereum 的文件
   └─ lib/
      ├─ chain.js                 链常量（Sepolia chainId / RPC / addEthereumChain 参数）
      ├─ errors.js                EIP-1193 错误码 → 中文 + isSepolia 容忍 4 种 chainId 类型
      └─ format.js                地址缩略 / 浏览器链接
```

**核心只有 3 个文件**：`hooks/useWallet.js`（逻辑）、`components/ConnectWalletButton.jsx` + `NetworkBadge.jsx`（UI）。
其余都是给它们打下手。`App.jsx` 里的状态表格是为了方便你观察状态机，不是模块的一部分。

---

## `useWallet()` 的接口

```js
const {
  status,        // loading | noMetaMask | disconnected | connecting | connected | wrongNetwork
  account,       // "0x…"（小写），来自 eth_accounts / eth_requestAccounts
  chainId,       // "0xaa36a7" 这样的十六进制字符串，来自 eth_chainId
  provider,      // ethers.BrowserProvider（包装 window.ethereum）
  signer,        // ethers.JsonRpcSigner —— 只用于签名，本模块不用
  error,         // 面向用户的中文错误文案
  connect,       // 点「连接钱包」→ eth_requestAccounts（弹窗）
  disconnect,    // 点「断开」→ wallet_revokePermissions（撤销本站授权）
  ensureSepolia, // 静默读链 → 不是 Sepolia 就 switch（4902 时先 add）→ 轮询复核
  isConnected,   // status === "connected"
  isWrongNetwork // status === "wrongNetwork"
} = useWallet();
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

事件：`accountsChanged`（换账号 / 钱包锁定）、`chainChanged`（换网络）。
两个监听器在 mount-only effect 里注册、卸载时 removeListener —— **依赖数组必须是 `[]` 类**，
否则每次渲染都会重复解绑/绑定（很多教程示例就漏了这点）。

---

## 移植到你自己的项目

只需要 4 步：

1. 复制 `src/hooks/useWallet.js`、`src/lib/chain.js`、`src/lib/errors.js`、`src/lib/format.js`
   （如果不用 Context，`context/WalletContext.jsx` 也可以一起拿走）。
2. 复制 `src/components/ConnectWalletButton.jsx` + `NetworkBadge.jsx`。
3. 把 `wallet.css` 里 `:root` 的 token 和你自己的主题合并（或直接整段贴进去）。
4. 装依赖：`ethers@^6`、`react@^18`。

改链（比如换成主网 / Linea / 自建链）只改 `lib/chain.js` 四个常量，其它文件不用动。

**要接业务时**，不要在 `useWallet.js` 里加合约代码 —— 在它上面再包一层
（大项目里就是 `useContract.js` + `useEvents.js`），把 `provider` / `signer` 往下传。
这样钱包层永远不认识任何合约，换项目可以直接搬。

---

## 几个容易被问到的点

- **为什么刷新页面不会重新弹窗？** 因为钱包那边「站点授权」还在，`eth_accounts` 直接返回地址。
  这不是前端做的持久化，前端没有任何 token/localStorage 登录态。
- **每次交易都要重新「连接钱包」吗？** 不用。连接（授权站点）一个来源只做一次；
  每笔**写操作**需要的是**当次签名确认**（钱包弹窗点确认），那是签名，不是连接。
- **`signer` 是干嘛的？** 它是 ethers 对「能签名的账户」的包装，`signer.sendTransaction()` 时
  钱包会弹确认。本模块拿到它但不使用 —— 这是给上层业务留的接口。
- **能不能不做网络检查？** 可以，但写操作会打到错误的链上。`ensureSepolia()` 在连接成功后自动跑一次，
  失败就把状态压成 `wrongNetwork`，由 `NetworkBadge` 给出「一键盘切换」。

---

## 与父项目的关系

| | 路径 | 说明 |
|---|---|---|
| 大项目 | `../frontend` | 完整门票 DApp（钱包 + 合约 + 活动面板） |
| 本模块 | `.` | 只有钱包层，代码与大项目**逐字一致**，唯一区别是 import 路径与剔除了 ABI |

改动本模块时如果想同步回大项目，只需要把 `lib/contract` ↔ `lib/chain` 的 import 换回来即可。
反过来也一样：**改了 `frontend/src/hooks/useWallet.js`，请在同一次提交里同步这一份**，
并手动 diff 确认只差那一行 import。

```bash
diff frontend/src/hooks/useWallet.js wallet-login/src/hooks/useWallet.js
```
