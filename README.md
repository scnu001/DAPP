# COMP7610 Final Project — Decentralized Ticket DApp

> 部署在 **Sepolia 测试网**上的去中心化门票 DApp：主办方开票（ERC-721 NFT 门票），参与者领取。
> 活动规则由智能合约强制执行，前端全程不接触私钥。

| 项 | 值 |
| --- | --- |
| 网络 | Sepolia Testnet（chainId `0xaa36a7` / `11155111`） |
| 合约地址 | [`0x567eC107b7abD99D1882476fb9336cc134de942f`](https://sepolia.etherscan.io/address/0x567eC107b7abD99D1882476fb9336cc134de942f) |
| 部署交易 | [`0x04f391cc61579a149734684122fc406a69270960506ba8b26027fe0f1b89facb`](https://sepolia.etherscan.io/tx/0x04f391cc61579a149734684122fc406a69270960506ba8b26027fe0f1b89facb) |
| 合约名称 / 符号 | `COMP7610 Ticket` / `TKT` |
| 合约 owner | [`0xa168dA3C44f8Aa8251499A71082da584814C041C`](https://sepolia.etherscan.io/address/0xa168dA3C44f8Aa8251499A71082da584814C041C) |
| 代码仓库 | <https://github.com/scnu001/DAPP> |

---

## 目录

- [一、项目文件说明](#一项目文件说明)
- [二、API 接口说明](#二api-接口说明)

---

## 一、项目文件说明

### 1.1 目录总览

```
comp7610-ticket-dapp/
├─ contracts/
│  └─ TicketNFT.sol                   唯一合约（ERC-721 + Ownable）
├─ test/
│  └─ TicketNFT.test.js               13 个单元测试（本地内存链）
├─ scripts/
│  ├─ deploy.js                       部署到指定网络
│  ├─ smoke.js                        本地链冒烟
│  ├─ smoke-sepolia.js                Sepolia 冒烟
│  ├─ verify-sepolia.mjs              只读核查线上实例（不发交易）
│  └─ export-remix.js                 导出可粘进 Remix 的合约源码
├─ deployments/
│  └─ sepolia.json                    部署产物：地址 + ABI
├─ frontend/                          完整门票 DApp 前端
│  ├─ index.html
│  ├─ vite.config.js
│  ├─ package.json / package-lock.json
│  ├─ .env.example
│  ├─ 启动本地服务.cmd                Windows 双击即起 dev server
│  └─ src/
│     ├─ main.jsx                     入口：挂载 React
│     ├─ App.jsx                      组装页面 + 角色门禁
│     ├─ styles/index.css
│     ├─ context/WalletContext.jsx
│     ├─ hooks/
│     │  ├─ useWallet.js              钱包层（唯一碰 window.ethereum）
│     │  ├─ useContract.js            只读 Provider 与 Signer 分离
│     │  └─ useEvents.js              活动数据 + 写操作状态机
│     ├─ lib/
│     │  ├─ contract.js               链常量 + Human-readable ABI
│     │  ├─ errors.js                 revert 解码与中文提示
│     │  ├─ events.js                 receipt 日志解析
│     │  └─ format.js                 地址缩略 / 浏览器链接 / 时间格式化
│     └─ components/
│        ├─ ConnectWalletButton.jsx   连接 / 断开按钮（纯展示）
│        ├─ NetworkBadge.jsx          网络徽章 + 切换 Sepolia（纯展示）
│        ├─ EventCard.jsx             单场活动卡片
│        ├─ OrganizerPanel.jsx        主办方：开票表单
│        ├─ AttendeePanel.jsx         参与者：领票 + 我的门票
│        └─ TxStatus.jsx              交易状态反馈
├─ wallet-login/                      钱包登录层单独抽出的可独立运行项目
│  ├─ index.html
│  ├─ vite.config.js
│  ├─ package.json / package-lock.json
│  ├─ .env.example / .gitignore
│  ├─ README.md                       该模块的独立说明
│  └─ src/
│     ├─ main.jsx
│     ├─ App.jsx                      演示页 + 状态表格
│     ├─ styles/wallet.css
│     ├─ context/WalletContext.jsx
│     ├─ hooks/useWallet.js           照搬 frontend 那份（逻辑零改动，另加文件头注释）
│     ├─ lib/
│     │  ├─ chain.js                  链常量（无 ABI、无合约地址）
│     │  ├─ errors.js                 EIP-1193 错误码 + isSepolia
│     │  └─ format.js                 地址缩略 / 浏览器链接
│     └─ components/
│        ├─ ConnectWalletButton.jsx
│        └─ NetworkBadge.jsx
├─ hardhat.config.js
├─ package.json / package-lock.json
├─ .env.example
├─ .gitignore / .gitattributes
├─ README.md                          你正在看的这份
├─ CONTRIBUTING.md                    环境准备 / 分支与提交 / PR 与评审
└─ .github/
   ├─ CODEOWNERS
   ├─ PULL_REQUEST_TEMPLATE.md
   ├─ ISSUE_TEMPLATE/{bug_report,feature_request}.md
   └─ workflows/ci.yml
```

### 1.2 合约层

| 文件 | 说明 |
| --- | --- |
| `contracts/TicketNFT.sol` | 唯一合约，145 行。`ERC721` + `Ownable`（OpenZeppelin v5）。承载活动创建、领票、闭场、metadata 更新与全部链上约束：仅 owner 可开票、每地址每活动限一张、票量上限、领取时间窗。 |
| `test/TicketNFT.test.js` | 13 个单元测试，跑在 Hardhat 内存链上（约 2 秒）。覆盖部署状态、eventId 自增、权限、参数校验、领取成功、一人一活动一张、跨活动各领一张、售罄、时间窗、闭场、`tokenURI` 拼接、`updateEventURI` 权限。 |

### 1.3 脚本层

| 文件 | 说明 |
| --- | --- |
| `scripts/deploy.js` | 部署合约，并把地址与 ABI 写入 `deployments/<network>.json`。 |
| `scripts/smoke.js` | 本地链冒烟：模拟前端的完整调用链（建活动 → 领票 → 重复领取被拒 → 闭场）。 |
| `scripts/smoke-sepolia.js` | 在 Sepolia 上跑同样的链路，用 `.env` 里的私钥在 Node 侧签名。 |
| `scripts/verify-sepolia.mjs` | **只读**核查已部署实例：字节码长度、`owner()`、`eventCount()`、每场活动的开放与售罄状态、指定地址的 `ticketOf`。不发任何交易。 |
| `scripts/export-remix.js` | 把合约连同带版本号的 import 生成为 `remix/TicketNFT.sol`，可直接粘进 Remix IDE。 |

### 1.4 前端 `frontend/`

| 文件 | 说明 |
| --- | --- |
| `src/main.jsx` | 入口，挂载 React 并引入全局样式。 |
| `src/App.jsx` | 组装页面；按链上 `owner()` 推导角色（主办方 / 参与者），`canWrite` 在合约未配置或网络不对时禁用写操作。 |
| `src/context/WalletContext.jsx` | 把 `useWallet()` 的状态挂到 Context，避免逐层透传。 |
| `src/hooks/useWallet.js` | **钱包层**，唯一读写 `window.ethereum` 的文件。连接 / 静默恢复 / 切链 / 事件监听全在这里，不认识任何合约。 |
| `src/hooks/useContract.js` | 只读 `Contract`（公共 RPC 兜底）与可写 `Contract`（绑定 `signer`）的分离点。 |
| `src/hooks/useEvents.js` | 活动列表 + 我的门票 + 四类写操作，统一走 `runTx` 状态机。 |
| `src/lib/contract.js` | 链常量、`SEPOLIA_NETWORK_PARAMS`、Human-readable `TICKET_ABI`。 |
| `src/lib/errors.js` | 从 Ethers v6 各种错误形态里挖出 revert 原因，并翻译成中文。 |
| `src/lib/events.js` | 解析交易回执日志（交易函数的返回值只能从事件里拿）。 |
| `src/lib/format.js` | 地址缩略、Etherscan 链接、`uint64` 秒 ↔ `datetime-local` 互转。 |
| `src/components/*.jsx` | 6 个纯展示组件：钱包按钮、网络徽章、活动卡片、主办方面板、参与者面板、交易状态。 |
| `启动本地服务.cmd` | Windows 双击即 `npm run dev`；缺 `node_modules` 会先 `npm install`。 |

### 1.5 钱包登录模块 `wallet-login/`

从大前端里**只抽出「连接钱包」这一层**的独立 Vite 项目：不含 ABI、不发交易、不调后端、不产生 token。

| 文件 | 说明 |
| --- | --- |
| `src/hooks/useWallet.js` | 与 `frontend/src/hooks/useWallet.js` 是**同一份代码**：逻辑零改动，只差 import 路径（`../lib/contract` ↔ `../lib/chain`）与文件头多出的一段注释。 |
| `src/lib/chain.js` | 链常量。相比 `frontend/src/lib/contract.js`，**已剔除** `TICKET_ABI` 与 `CONTRACT_ADDRESS`。 |
| `src/lib/errors.js` | 已剔除业务 `REVERT_MAP`，只保留 EIP-1193 错误码与 `isSepolia`。 |
| `src/lib/format.js` | 只保留 `shortAddress` / `explorerAddress`。 |
| `src/components/` | 只有 `ConnectWalletButton` 与 `NetworkBadge`。 |
| `src/App.jsx` | 演示页：组装组件 + 打印 `useWallet()` 的原始状态，便于观察状态机。 |
| `README.md` | 该模块的接口表、EIP-1193 方法表、移植步骤。 |

> ⚠️ `wallet-login/` 与 `frontend/` **都监听 5173**，不能同时启动。跑 `wallet-login` 之前先停掉 `frontend` 的 dev server。

### 1.6 工程与协作配置

| 文件 | 说明 |
| --- | --- |
| `hardhat.config.js` | Hardhat 配置：`localhost`（31337）与 `sepolia` 两个网络，`sepolia` 从 `.env` 读 `DEPLOYER_PRIVATE_KEY`。 |
| `package.json` | 根目录脚本：`compile` / `test` / `node` / `deploy:*` / `smoke:*` / `export:remix`。 |
| `deployments/sepolia.json` | 部署产物（地址 + ABI），README 与验证脚本都引用它。 |
| `.env.example` | 根目录环境变量模板（`DEPLOYER_PRIVATE_KEY` / `TEST_CLAIMER_PRIVATE_KEY`）。**真实 `.env` 不入库。** |
| `CONTRIBUTING.md` | 环境准备、分支与提交规范、PR 与代码评审要求。 |
| `.github/` | CODEOWNERS、PR 模板、两个 Issue 模板、CI 流水线（合约测试 + 两个前端构建）。 |

---

## 二、API 接口说明

本项目没有后端服务，对外接口由两部分构成：**链上的智能合约**，以及**前端模块导出的 JavaScript 接口**。

### 2.1 智能合约接口 `TicketNFT`

`contracts/TicketNFT.sol` · `pragma ^0.8.20` · 继承 OpenZeppelin v5 的 `ERC721` 与 `Ownable`。

#### 2.1.1 部署信息

| 项 | 值 |
| --- | --- |
| 地址 | `0x567eC107b7abD99D1882476fb9336cc134de942f` |
| 网络 | Sepolia（`11155111` / `0xaa36a7`） |
| 部署区块 | `11739230`（gasUsed 2,036,337） |
| 构造函数 | `constructor() ERC721("COMP7610 Ticket", "TKT") Ownable(msg.sender)` |

#### 2.1.2 数据结构

```solidity
struct EventInfo {
    string  name;      // 活动名
    string  baseURI;   // metadata 基地址，tokenURI = baseURI + tokenId + ".json"
    uint64  startAt;   // 领取开始时间（Unix 秒；0 = 立即开始）
    uint64  endAt;     // 领取结束时间（Unix 秒；0 = 不限制）
    uint32  maxSupply; // 门票上限（> 0 即视为活动存在）
    uint32  minted;    // 已领取数量
    bool    open;      // 是否开放（closeEvent 后置 false）
    address organizer; // 主办方
}
```

#### 2.1.3 状态变量与映射

| 成员 | 类型 | 可见性 | 说明 |
| --- | --- | --- | --- |
| `nextEventId` | `uint256` | `public` | 下一个待分配的 eventId，**从 1 开始**。 |
| `claimed` | `mapping(uint256 => mapping(address => bool))` | `public` | `eventId => 地址 => 是否已领`。「每地址每活动一张」的强制点。 |
| `ticketOf` | `mapping(uint256 => mapping(address => uint256))` | `public` | `eventId => 地址 => tokenId`，**`0` 表示未持有**。 |
| `_events` | `mapping(uint256 => EventInfo)` | `private` | 活动本体，通过 `getEventInfo()` 读。 |
| `_eventOfToken` | `mapping(uint256 => uint256)` | `private` | `tokenId => eventId` 反查，通过 `eventOfToken()` 读。 |
| `_nextTokenId` | `uint256` | `private` | 下一个 tokenId，从 1 开始。 |

> 活动存在性用 `maxSupply != 0` 判断（`EventInfo` 里只有这一个字段一定会被写入），省一个 storage slot。

#### 2.1.4 写方法

| 方法 | 权限 | 返回 | 说明 |
| --- | --- | --- | --- |
| `createEvent(string name, string baseURI, uint64 startAt, uint64 endAt, uint32 maxSupply)` | **仅 owner**（`onlyOwner`） | `uint256 eventId` | 创建活动。新 eventId 取 `nextEventId` 后自增；`open` 初始为 `true`，`organizer` 置为 `msg.sender`。 |
| `claim(uint256 eventId)` | 任何地址 | `uint256 tokenId` | 领取门票。成功时 `_safeMint` 铸造 NFT，并记录 `claimed` / `ticketOf` / `minted`。 |
| `closeEvent(uint256 eventId)` | **主办方或 owner** | — | 闭场，`open` 置 `false`，之后 `claim` 一律 revert。 |
| `updateEventURI(uint256 eventId, string baseURI)` | **主办方或 owner** | — | 更新 metadata 基地址（先开票、后传 IPFS 的场景）。 |

**`claim` 的前提条件**（按检查顺序）：

1. 活动存在 —— `maxSupply != 0`
2. 活动开放 —— `open == true`
3. 已到开始时间 —— `startAt <= block.timestamp`
4. 未过结束时间 —— `endAt == 0 || block.timestamp <= endAt`
5. 未售罄 —— `minted < maxSupply`
6. 本人未领过 —— `!claimed[eventId][msg.sender]`

**`createEvent` 的前提条件**：`maxSupply > 0`；且 `endAt == 0 || endAt > startAt`。

> ⚠️ **交易函数的返回值前端拿不到。** `createEvent` 的 `eventId`、`claim` 的 `tokenId` 都必须从交易回执的事件里解析（见 `src/lib/events.js`）。这是 EVM 的固有特性 —— 写方法只能拿到交易哈希，不能拿到返回值。
>
> 合约内部遵循 **CEI**（先落定状态、再做 `_safeMint` 外部调用），避免重入。

#### 2.1.5 读方法

| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `getEventInfo(uint256 eventId)` | `EventInfo` | 读取活动全部字段。活动不存在时返回全零结构体（不 revert）。 |
| `eventCount()` | `uint256` | 活动总数，等于 `nextEventId - 1`。 |
| `eventOfToken(uint256 tokenId)` | `uint256` | 由 tokenId 反查所属 eventId。token 不存在则 revert。 |
| `tokenURI(uint256 tokenId)` | `string` | 拼接 `baseURI + tokenId + ".json"`；`baseURI` 为空时返回空串。 |
| `owner()` | `address` | 合约 owner（继承自 `Ownable`），前端据此推导主办方角色。 |

> ⚠️ 不要给合约方法起名 `getEvent` —— Ethers v6 的 `Contract` 自带 `getEvent()`，会撞名并报 `TypeError: key.format is not a function`。同理要避开 `getFunction` / `getFragment` / `getAddress` / `getBalance`。这就是这里叫 `getEventInfo` 的原因。

继承自 `ERC721` 的常用只读方法：`balanceOf(address)`、`ownerOf(uint256)`、`name()`、`symbol()`。继承自 `ERC721` 的转让方法：`approve` / `setApprovalForAll` / `transferFrom` / `safeTransferFrom`。

#### 2.1.6 事件

```solidity
event EventCreated(uint256 indexed eventId, address indexed organizer, string name,
                   uint32 maxSupply, uint64 startAt, uint64 endAt);
event TicketClaimed(uint256 indexed eventId, address indexed attendee, uint256 indexed tokenId);
event EventClosed  (uint256 indexed eventId, uint32 totalMinted);
event EventURIUpdated(uint256 indexed eventId, string baseURI);
```

- 一个事件最多 3 个 `indexed`；`TicketClaimed` 三个字段全 index，便于按 `eventId` 或 `attendee` 过滤。
- `string` **不加** `indexed` —— 动态类型的 `indexed` 只存 keccak 哈希，前端拿不回原文。
- 前端解析回执见 `src/lib/events.js`；查历史领取名单要用 `queryFilter`，不要用 `receipt.logs`（那只有当前这一笔）。

#### 2.1.7 错误信息

合约用 `require` 字符串（不是自定义 error），前端 `src/lib/errors.js` 把它们映射成中文：

| revert 字符串 | 触发条件 | 前端提示 |
| --- | --- | --- |
| `Ticket: event not found` | 活动不存在 | 活动不存在 |
| `Ticket: event closed` | 活动已闭场 | 活动已关闭，停止发放 |
| `Ticket: already closed` | 重复闭场 | 活动已经是关闭状态了 |
| `Ticket: not started` | 未到 `startAt` | 领取还没开始 |
| `Ticket: event ended` | 已过 `endAt` | 领取已结束 |
| `Ticket: sold out` | `minted == maxSupply` | 票已领完 |
| `Ticket: already claimed` | 本地址已领过 | 你已经领过这场活动的票了（每人每活动限一张） |
| `Ticket: zero supply` | `maxSupply == 0` | 门票上限必须大于 0 |
| `Ticket: bad time range` | `endAt <= startAt` | 结束时间必须晚于开始时间 |
| `Ticket: not organizer` | 非主办方且非 owner | 只有主办方可以执行该操作 |
| `OwnableUnauthorizedAccount` | `createEvent` 被非 owner 调用 | 只有合约 owner 可以创建活动 |
| `ERC721InvalidReceiver` | `_safeMint` 目标是不支持 NFT 的合约 | 接收地址不支持 NFT（不能是合约） |

#### 2.1.8 Gas 消耗（Sepolia 实测）

| 操作 | gasUsed | 备注 |
| --- | --- | --- |
| 部署 | 2,036,337 | 一次性 |
| `createEvent` | 125,004 | 写入一个 `EventInfo` |
| `claim` | 148,856 | 含一次 ERC-721 铸造 |
| `closeEvent` | 30,518 | 只改一个 bool |

按 Sepolia 约 1 gwei 计算，主办方开一场活动 + 参与者领一张，总花费约 `0.0003 ETH`。

---

### 2.2 前端模块接口 `frontend/src/`

前端不对外暴露 HTTP 接口，接口即下面这几个 hook 与 lib 模块的导出。

#### 2.2.1 `useWallet()` — `src/hooks/useWallet.js`

```js
const {
  status,          // "loading" | "noMetaMask" | "disconnected" | "connecting" | "connected" | "wrongNetwork"
  account,         // "0x…"（小写）；未连接为 ""
  chainId,         // 十六进制字符串，如 "0xaa36a7"
  provider,        // ethers.BrowserProvider | null
  signer,          // ethers.JsonRpcSigner | null（只用于签名）
  error,           // 面向用户的中文错误文案；无错误为 ""
  connect,         // () => Promise<void>   点「连接钱包」→ eth_requestAccounts（弹窗）
  disconnect,      // () => Promise<void>   点「断开」→ wallet_revokePermissions（静默）
  ensureSepolia,   // () => Promise<void>   幂等：不是 Sepolia 就切（4902 时先 add）→ 轮询复核
  isConnected,     // status === "connected"
  isWrongNetwork,  // status === "wrongNetwork"
} = useWallet();
```

**状态机**：

```
loading ──┬─→ noMetaMask                        页面里没有 window.ethereum
          └─→ disconnected ⇄ connecting ─→ connected ⇄ wrongNetwork
                    ↑                        │
                    └────── disconnect ──────┘
```

**约定**：`window.ethereum` **只允许出现在这个文件里**。接业务不要在 `useWallet.js` 里加合约代码，要在它上层再包一层（本项目的 `useContract` + `useEvents`），把 `provider` / `signer` 往下传。

**事件监听**：`accountsChanged`（换账号 / 钱包锁定）与 `chainChanged`（换网络）在 **mount-only effect** 里注册、卸载时 `removeListener`，依赖数组必须是 `[]` 类 —— 否则每次渲染都会重复解绑/绑定。换账号会作废旧 signer 并清空上一账号的业务状态。

#### 2.2.2 `useContract(wallet)` — `src/hooks/useContract.js`

```js
const { readProvider, readContract, writeContract, contractReady } = useContract(wallet);
```

| 返回值 | 类型 | 说明 |
| --- | --- | --- |
| `readProvider` | `BrowserProvider \| JsonRpcProvider` | 已连钱包时用钱包的 provider，否则回落到公共 RPC —— 所以**没连钱包也能浏览活动列表**。 |
| `readContract` | `Contract \| null` | 只读合约实例；`CONTRACT_ADDRESS` 为空时为 `null`。 |
| `writeContract` | `Contract \| null` | 绑定 `signer` 的合约实例；未连接或地址未配置时为 `null`，UI 据此禁用写按钮。 |
| `contractReady` | `boolean` | 等价于 `Boolean(readContract)`。 |

#### 2.2.3 `useEvents({ wallet, readContract, writeContract })` — `src/hooks/useEvents.js`

```js
const {
  events,          // EventItem[]  已按「新活动在前」排序
  owner,           // string        链上 owner() 地址
  myTickets,       // { [eventId: string]: tokenId: string }  当前账户持票映射
  isOrganizer,     // boolean       由 owner() 与当前账户比较推导（地址已归一化）
  tx,              // TxState       写操作状态机
  loading,         // boolean       只读数据加载中
  loadError,       // string        只读加载失败原因
  refresh,         // () => Promise<void>              重新拉取活动列表与我的门票
  createEvent,     // (form) => Promise<bigint | null>  返回新 eventId
  claim,           // (eventId) => Promise<{ tokenId, eventId } | null>
  closeEvent,      // (eventId) => Promise<void>
  updateEventURI,  // (eventId, baseURI) => Promise<void>
  setTx,           // 手动重置 / 干预交易状态
} = useEvents({ wallet, readContract, writeContract });
```

**`events` 单项结构**：

```ts
{
  eventId: number,      // 注意已由 bigint 转成 number
  name: string,
  baseURI: string,
  startAt: number,      // Unix 秒
  endAt: number,        // Unix 秒，0 = 不限制
  maxSupply: number,
  minted: number,
  open: boolean,
  organizer: string,
}
```

**`tx` 状态机**（四类写操作共用）：

```ts
{ state: "idle" }
{ state: "submitting", label }                 // 已发起，等钱包确认
{ state: "pending",    label, hash }           // 已拿到交易哈希，等上链
{ state: "success",    label, hash, receipt }  // receipt.status === 1
{ state: "error",      label, hash, reason }   // revert，reason 已翻译成中文
```

**`createEvent(form)` 的入参**：

```ts
{ name: string, baseURI: string, startAt: number, endAt: number, maxSupply: number }
```

写操作统一走内部的 `runTx`：先 `ensureSepolia()`（幂等）→ `send()` → `setTx("pending", hash)` → `response.wait(1)` → 校验 `receipt.status === 1` → `refresh()`。任何一步失败都会用 `decodeRevert()` 解析原因写入 `tx.reason`，然后原样抛出。

#### 2.2.4 `src/lib/contract.js` — 链常量与 ABI

| 导出 | 类型 | 说明 |
| --- | --- | --- |
| `SEPOLIA_CHAIN_ID` | `string` | `"0xaa36a7"`，EIP-3326 要求的十六进制形式。 |
| `SEPOLIA_CHAIN_ID_DEC` | `number` | `11155111`，用于展示与比较。 |
| `SEPOLIA_RPC_URL` | `string` | 公共只读 RPC，默认 `https://ethereum-sepolia-rpc.publicnode.com`，可用 `VITE_SEPOLIA_RPC_URL` 覆盖。 |
| `SEPOLIA_EXPLORER_URL` | `string` | `https://sepolia.etherscan.io`。 |
| `CONTRACT_ADDRESS` | `string` | 从 `VITE_CONTRACT_ADDRESS` 读取；未配置为空串（此时 `readContract` 为 `null`）。 |
| `SEPOLIA_NETWORK_PARAMS` | `object` | `wallet_addEthereumChain` 的参数，处理 4902 时用。 |
| `TICKET_ABI` | `string[]` | Human-readable ABI（Ethers v6 支持）。与 2.1 的接口一一对应，**改动合约必须同步此数组**。 |

#### 2.2.5 `src/lib/events.js` — 回执日志解析

| 导出 | 签名 | 说明 |
| --- | --- | --- |
| `parseLogs` | `(contract, receipt) => ParsedLog[]` | 逐个 `parseLog` 并按 ABI 过滤，解析不了的跳过。**不要直接取 `logs[0]`** —— 回执里会有别的合约的日志。 |
| `findLog` | `(contract, receipt, name) => ParsedLog \| null` | 按事件名查找。 |
| `eventIdFromReceipt` | `(contract, receipt) => bigint \| null` | 取 `createEvent` 回执里的新 eventId。 |
| `claimFromReceipt` | `(contract, receipt) => { eventId, attendee, tokenId } \| null` | 取 `claim` 回执里的 tokenId。 |
| `fetchClaimers` | `async (contract, eventId, fromBlock = 0) => Claimer[]` | 用 `queryFilter` 拉某场活动的历史领取名单。公共 RPC 对区块区间有限制，活动量大时建议按部署区块分段查。 |

#### 2.2.6 `src/lib/errors.js` — 错误解码

| 导出 | 签名 | 说明 |
| --- | --- | --- |
| `extractRevertData` | `(err) => string \| null` | 挖出原始 revert data。Ethers v6 在不同 provider 下 `err.data` 类型不同（MetaMask 是 hex 字符串，Hardhat 是对象），所以 `err.data` / `err.error.data` / `err.info.error.data` / `err.revert.data` 四处都试。 |
| `decodeRevert` | `(err, iface) => string` | 按优先级提取原因：`revert.args[0]` → `revert.name` → `reason` → `iface.parseError(rawData)` → `shortMessage` → `info.error.message`。 |
| `friendlyMessage` | `(reason) => string` | 按 2.1.7 的映射表翻译成中文；识别「用户拒绝」；认不出来则原样返回（超 160 字符截断）。 |
| `isSepolia` | `(chainId) => boolean` | 容忍 `string` / `number` / `bigint` 三种类型与大小写。 |

#### 2.2.7 `src/lib/format.js` — 格式化与链接

| 导出 | 签名 | 说明 |
| --- | --- | --- |
| `shortAddress` | `(addr) => string` | `0x1234…abcd`。 |
| `explorerAddress` | `(addr) => string` | Etherscan 地址页链接。 |
| `explorerTx` | `(hash) => string` | Etherscan 交易页链接。 |
| `explorerNft` | `(contract, tokenId) => string` | NFT 实例页：`/token/{contract}?a={tokenId}`。 |
| `explorerContract` | `(addr) => string` | 合约页（锚到源码 `#code`）。 |
| `formatTime` | `(seconds) => string` | `uint64` 秒 → 本地时间字符串；`0` 显示「不限制」。 |
| `toDatetimeLocal` | `(seconds) => string` | `0` → `""`，用于表单回显。 |
| `datetimeLocalToSeconds` | `(value) => number` | `datetime-local` 的值 → `uint64` 秒（本地时区）。 |

---

### 2.3 钱包登录模块接口 `wallet-login/src/`

`wallet-login/` 是 2.2 里钱包层的独立可运行版本。**钱包层的代码是同一份** —— `useWallet.js` / `ConnectWalletButton` / `NetworkBadge` / `WalletContext` 四个文件的逻辑零改动，差异如下：

| 项 | `frontend/src` | `wallet-login/src` |
| --- | --- | --- |
| 链常量文件 | `lib/contract.js`（含 `TICKET_ABI`、`CONTRACT_ADDRESS`） | `lib/chain.js`（**只有链常量，无 ABI、无合约地址**） |
| 错误表 | `lib/errors.js` 含业务 `REVERT_MAP`（11 条 `Ticket: xxx` → 中文） | 同一文件，**已剔除业务 revert 表**，只留 EIP-1193 错误码 |
| `lib/format.js` | 8 个函数（地址 / 交易 / NFT / 合约四种链接 + 时间互转） | 只留 `shortAddress` / `explorerAddress` |
| `useWallet.js` 的 import | `../lib/contract` | `../lib/chain` |
| 文件头注释 | — | 抽出版额外加了一段注释，说明与父项目的对应关系 |

> ⚠️ 所以 `diff frontend/src/hooks/useWallet.js wallet-login/src/hooks/useWallet.js` 会看到 **7 行差异**（1 行 import + 5 行新增注释 + 1 行空注释），这是**预期**的；只有出现**逻辑差异**才说明两份漂移了。

#### 2.3.1 `wallet-login/src/lib/` 导出

| 模块 | 导出 | 说明 |
| --- | --- | --- |
| `chain.js` | `SEPOLIA_CHAIN_ID` / `SEPOLIA_CHAIN_ID_DEC` / `SEPOLIA_RPC_URL` / `SEPOLIA_EXPLORER_URL` / `SEPOLIA_NETWORK_PARAMS` | 与 2.2.4 的同名常量语义一致，**但没有 `TICKET_ABI` 与 `CONTRACT_ADDRESS`**。 |
| `errors.js` | `isSepolia(chainId) => boolean` | 容忍 `string` / `number` / `bigint` 三种输入（事件给的是 hex 字符串，`getNetwork()` 给的是 bigint）。 |
| `errors.js` | `codeOf(err) => number \| null` | 从 `err.code` / `err.error.code` / `err.info.error.code` 里挖出 EIP-1193 错误码。 |
| `errors.js` | `friendlyMessage(err) => string` | 翻译顺序：错误码 → 用户拒绝文案 → Ethers `shortMessage` → 原始 `message`（超 160 字符截断）。 |
| `format.js` | `shortAddress(addr)` / `explorerAddress(addr)` | 地址缩略与 Etherscan 地址页链接。 |

内置的 EIP-1193 错误码表：

| 错误码 | 含义 |
| --- | --- |
| `4001` | 你在钱包里取消了这次操作 |
| `4100` | 钱包未授权（需要先连接钱包） |
| `4200` | 钱包不支持该方法 |
| `4900` | 钱包与节点断开连接 |
| `4901` | 钱包未连接到该网络 |
| `4902` | 钱包里还没有 Sepolia 这个网络（需先添加）→ 触发 `wallet_addEthereumChain` |

`useWallet()` 的返回结构与 2.2.1 完全相同。该模块的对外接口就是它，外加两个纯展示组件：

| 组件 | Props | 说明 |
| --- | --- | --- |
| `ConnectWalletButton` | `{ wallet }` | 按 `status` 渲染「连接钱包 / 断开」或「安装 MetaMask」。 |
| `NetworkBadge` | `{ wallet }` | 显示当前网络；非 Sepolia 时给「切换到 Sepolia」按钮。 |

**用到的 EIP-1193 方法**：

| 方法 | 何时调用 | 弹不弹窗 |
| --- | --- | --- |
| `eth_accounts` | 挂载时静默恢复上次授权 | 不弹 |
| `eth_requestAccounts` | 点「连接钱包」 | **弹** |
| `eth_chainId` | 每次判断网络前静默读一次 | 不弹 |
| `wallet_switchEthereumChain` | 网络不对时切到 Sepolia | **弹** |
| `wallet_addEthereumChain` | 上一步报 4902（钱包里没这条链）时补一次 | **弹** |
| `wallet_revokePermissions` | 点「断开」 | 不弹（部分钱包不支持，已 try/catch 吞掉） |

监听事件：`accountsChanged`（换账号 / 钱包锁定）、`chainChanged`（换网络）。

> 该模块的详细说明、状态机图与移植步骤见 [`wallet-login/README.md`](./wallet-login/README.md)。

---

> 环境准备、启动命令、分支与提交规范、PR 与代码评审流程见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。

## 许可证

课程项目（COMP7610 Final Project），默认内部可见。如需指定开源协议请补充 `LICENSE` 文件。
