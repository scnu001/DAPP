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
│  ├─ bench-reads.mjs                 只读性能基准：逐个调用 vs Multicall3
│  ├─ publish-frontend.mjs            构建前端并复制到 docs/app/（Pages 发布）
│  └─ export-remix.js                 导出可粘进 Remix 的合约源码
├─ deployments/
│  └─ sepolia.json                    部署产物：地址 + ABI
├─ shared/
│  └─ wallet/                         ★ 共享钱包模块（全项目唯一真源）
│     ├─ README.md                    模块接口、状态机、移植步骤
│     └─ src/
│        ├─ index.js                  ★ 唯一公开入口；外面只从这里 import
│        ├─ hooks/useWallet.js        钱包状态机（唯一读写 window.ethereum）
│        ├─ context/WalletContext.jsx WalletProvider / useWalletContext
│        ├─ components/
│        │  ├─ ConnectWalletButton.jsx 连接 / 断开按钮（纯展示）
│        │  └─ NetworkBadge.jsx        网络徽章 + 切换 Sepolia（纯展示）
│        ├─ lib/
│        │  ├─ chain.js                链常量（无 ABI、无合约地址）
│        │  ├─ errors.js               EIP-1193 错误码 / isSepolia / 中文提示
│        │  └─ format.js               地址缩略 / 浏览器地址页
│        └─ styles/wallet.css          设计 token + 骨架 + 按钮 + 徽章 + 横幅
├─ frontend/                          门票业务前端（消费 @wallet）
│  ├─ index.html
│  ├─ vite.config.js                  含 @wallet 别名 → ../shared/wallet/src
│  ├─ package.json / package-lock.json
│  ├─ .env.example                    合约地址 / relay 地址 / 兜底开关三个变量
│  ├─ 启动本地服务.cmd                Windows 双击即起 dev server
│  └─ src/
│     ├─ main.jsx                     入口：挂载 React
│     ├─ App.jsx                      组装页面 + 角色门禁
│     ├─ styles/index.css             @import "@wallet/styles/wallet.css" + 业务样式
│     ├─ hooks/
│     │  ├─ useContract.js            ★ 钱包接口 → 合约实例（signer → Contract）
│     │  ├─ useEvents.js              活动数据 + 写操作状态机（铸造 / 领取 / 闭场）
│     │  ├─ useCoverUpload.js         ★ 封面流水线：relay / 本机两条路共用一个状态机
│     │  ├─ useLocalCovers.js         本机封面缓存（localStorage）→ React 状态
│     │  └─ useTicketArt.js           一张票的封面从哪儿来：本机缓存 → tokenURI → JSON
│     ├─ lib/
│     │  ├─ contract.js               合约地址 + Human-readable ABI
│     │  ├─ multicall.js              把 N 个只读调用打包成一次 eth_call（Multicall3）
│     │  ├─ relay.js                  封面/元数据服务的客户端（无 window.ethereum）
│     │  ├─ localCover.js             路线 0 兜底：canvas 压缩 + localStorage（默认关）
│     │  ├─ tokenMetadata.js          按 NFT 阅读器的方式取 tokenURI → JSON → image
│     │  ├─ errors.js                 revert 解码与中文提示（业务层）
│     │  ├─ events.js                 receipt 日志解析
│     │  └─ format.js                 业务格式化（交易 / NFT / 合约链接、时间互转）
│     └─ components/
│        ├─ EventCard.jsx             单场活动卡片（主办方可见「设置活动封面」）
│        ├─ OrganizerPanel.jsx        主办方：开票表单 + 建完即传封面
│        ├─ CoverUpload.jsx           ★ 选图 / 预览 / 上传 / 结果链接
│        ├─ AttendeePanel.jsx         参与者：我的门票
│        └─ TxStatus.jsx              交易状态反馈
├─ wallet-login/                      @wallet 的演示壳（不含任何钱包实现）
│  ├─ index.html
│  ├─ vite.config.js                  含 @wallet 别名
│  ├─ package.json / package-lock.json
│  ├─ .env.example / .gitignore
│  ├─ README.md                       该演示壳的独立说明
│  ├─ e2e/run-wallet-login.mjs        转调父仓库的真钱包脚本
│  └─ src/
│     ├─ main.jsx                     引入 @wallet 样式 + 演示样式
│     ├─ App.jsx                      演示页：组装组件 + 打印原始状态
│     └─ styles/demo.css              仅本页用到的 .kv / .notes
├─ relay/                             ★ 封面 / metadata 上传服务（Cloudflare Worker）
│  ├─ src/index.js                    Worker 本体（单文件，约 210 行含注释）
│  ├─ wrangler.toml                   name + [vars]：PAGES_BASE / PAGES_DIR …
│  ├─ test-local.mjs                  本地测试：守卫 / 真签名验签 / 凭据只读检查
│  ├─ upload-cover.mjs                命令行上传，并自动发 updateEventURI
│  ├─ 部署.cmd                        Windows 双击：login → secret put → deploy
│  └─ README.md                       路由表、两条路线对比、信任模型、部署步骤
├─ docs/                              ★ GitHub Pages 发布根（内容原样挂到站点上）
│  ├─ index.html                      首页：逐个读 events/*.json，验证 metadata 真可读
│  ├─ images/event-<id>.<ext>         活动封面（由 relay 写入）
│  └─ events/event-<id>.json          每场活动的 metadata JSON（同上）
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
| `scripts/bench-reads.mjs` | **只读**性能基准：对比逐个调用与 Multicall3 批量读的 HTTP 请求数 / JSON-RPC 调用数，并校验两种写法结果一致。 |
| `scripts/publish-frontend.mjs` | 构建 `frontend/` 并把产物复制到 `docs/app/`，于是前端也由 GitHub Pages 静态托管（`/DAPP/app/`）。会在构建前拦住「本地地址被打进线上产物」这类错误。 |
| `scripts/export-remix.js` | 把合约连同带版本号的 import 生成为 `remix/TicketNFT.sol`，可直接粘进 Remix IDE。 |

### 1.4 前端 `frontend/`

| 文件 | 说明 |
| --- | --- |
| `src/main.jsx` | 入口，挂载 React 并引入全局样式。 |
| `src/App.jsx` | 组装页面。钱包层全部来自 `@wallet`（`WalletProvider` / `useWalletContext` / 两个组件）；按链上 `owner()` 推导角色，`canWrite` 在合约未配置、网络不对或无 signer 时禁用写操作。 |
| `src/styles/index.css` | 第一行 `@import "@wallet/styles/wallet.css";` 复用钱包模块的设计 token 与视觉基元，之后只写门票业务自己的样式（表单 / 卡片 / 标签 / 我的门票 / 交易状态）。 |
| `src/hooks/useContract.js` | **「业务建在钱包接口之上」的范例**：拿 `wallet.provider` / `wallet.signer` 建 `Contract`。只读实例有公共 RPC 兜底，所以不连钱包也能浏览活动列表。 |
| `src/hooks/useEvents.js` | 活动列表 + 我的门票 + 四类写操作，统一走 `runTx` 状态机；写操作前先 `wallet.ensureSepolia()`。**读路径经 `lib/multicall.js` 一次打包**，不再逐个 id 调用（见 2.3.7）。 |
| `src/lib/contract.js` | **只有**合约地址与 `TICKET_ABI`（链常量已上移到 `@wallet`）。 |
| `src/lib/multicall.js` | 把 N 个只读调用打包成一次 `eth_call`（Multicall3），把 JSON-RPC 调用数从 O(N) 降为常数级；失败时回退为逐个调用。 |
| `src/lib/relay.js` | 链下 metadata 服务的客户端：拼 multipart、解析错误、`pingRelay()` 健康探测。**没有 `window.ethereum`、没有私钥** —— 签名由上层从 `wallet.signer` 拿。 |
| `src/hooks/useCoverUpload.js` | 封面流水线状态机，**relay / 本机两条路共用一个**：relay 走 `ensureSepolia → signMessage → POST /upload → updateEventURI`；本机兜底走 `shrinkImage → localStorage`。状态为 `signing / uploading / updating / done / error`。 |
| `src/hooks/useLocalCovers.js` | 把 `lib/localCover.js` 的 localStorage 存储包成 React 状态，并统计本机已占用的字节数（用于兑现「兜底模式的代价」这句话）。 |
| `src/hooks/useTicketArt.js` | 一张票的封面从哪儿来：本机缓存 → `tokenURI` → 取那份 JSON 的 `image`。**只在「自己持有这张票」时才去拉**（见 2.3.8）。 |
| `src/components/CoverUpload.jsx` | 封面控件：选图、本地预览、上传/保存按钮、结果链接。`file` 与 `preview` **必须在同一个 handler 里同生同灭** —— 曾经 `preview` 由 `useEffect(file)` 派生，`setFile(null)` 之后会先渲染出一帧 `file === null`，`{file.name}` 抛异常把整个 React 树打崩（无错误边界 ⇒ 白屏）；现在两者一起改，渲染处另有 `preview && file` 兜底。 |
| `src/lib/localCover.js` | **路线 0 兜底**：canvas 缩放重编码（≤960×600，优先 WebP、回退 JPEG）+ `localStorage` 读写。默认关闭，由 `VITE_LOCAL_COVER` 控制。 |
| `src/lib/tokenMetadata.js` | `toFetchable()`（`ipfs://` → 网关）与 `fetchTokenMetadata()`（带会话内缓存的 fetch）。**故意不特殊处理 `#`** —— 浏览器本来就会在发请求前丢掉 fragment。 |
| `src/lib/errors.js` | 业务层错误：从 Ethers v6 各种错误形态里挖出 revert 原因，并翻译成中文。 |
| `src/lib/events.js` | 解析交易回执日志（交易函数的返回值只能从事件里拿）。 |
| `src/lib/format.js` | 业务格式化（交易 / NFT / 合约链接、时间互转）；`shortAddress` / `explorerAddress` 从 `@wallet` re-export，不再各写一份。 |
| `src/components/*.jsx` | 5 个业务组件：活动卡片、主办方面板、封面上传、参与者面板、交易状态。（钱包按钮与网络徽章已移入 `@wallet`。） |
| `启动本地服务.cmd` | Windows 双击即 `npm run dev`；缺 `node_modules` 会先 `npm install`。 |

### 1.5 共享钱包模块 `shared/wallet/` ★

全项目**唯一**的钱包实现。它只做一件事：连接状态、账号、链、`signer`，以及自动切到 Sepolia。
它不认识任何合约 —— 没有 ABI、没有合约地址、没有后端调用（搜 `claim` / `createEvent` / `TicketNFT` 都搜不到）。

| 文件 | 说明 |
| --- | --- |
| `src/index.js` | **唯一公开入口**。消费方只允许 `import { … } from "@wallet"`，不要写 `@wallet/hooks/useWallet` 这类深层路径 —— 那是内部实现，随时可能改。公开接口共 5 组：React 装配、现成组件、钱包状态对象、链常量、无状态助手。 |
| `src/hooks/useWallet.js` | 钱包状态机，**唯一读写 `window.ethereum` 的文件**。连接 / 静默恢复 / 切链 / 事件监听全在这里。 |
| `src/context/WalletContext.jsx` | `WalletProvider` + `useWalletContext()`，避免 props 层层透传。 |
| `src/components/ConnectWalletButton.jsx` | 「连接钱包 / 断开」按钮，纯展示，只吃一个 `wallet` prop。 |
| `src/components/NetworkBadge.jsx` | 网络徽章 + 「切换到 Sepolia」，纯展示。 |
| `src/lib/chain.js` | 链常量。**想换链只改这一个文件**（4 个常量）。 |
| `src/lib/errors.js` | EIP-1193 错误码表、`isSepolia`、`isUserRejection`、`friendlyWalletError`。**不含合约 revert**（那是业务层 `frontend/src/lib/errors.js` 的事）。 |
| `src/lib/format.js` | `shortAddress` / `explorerAddress`（只拼 URL，不发请求）。 |
| `src/styles/wallet.css` | 设计 token（`:root`）、reset、页面骨架、按钮、地址框、网络徽章、横幅。两个项目共用同一份，视觉天然一致。 |
| `README.md` | 接口表、状态机图、EIP-1193 方法表、**移植到其它项目的步骤**。 |

**怎么被引用**：两个 Vite 项目各在 `vite.config.js` 里配一条别名 ——

```js
resolve: { alias: { "@wallet": fileURLToPath(new URL("../shared/wallet/src", import.meta.url)) } }
```

于是 `frontend/` 与 `wallet-login/` 引用的是**同一份文件**，改一处两边同时生效，不再有「两份拷贝会不会漂移」的问题。
（用 `fileURLToPath` 而不是 `new URL().pathname`：中文路径下 `pathname` 会带 `%E4%BD%9C` 这类编码。）

### 1.6 演示壳 `wallet-login/`

`@wallet` 的**演示壳**：这里没有任何钱包实现代码，只有一个页面骨架 + 状态表格。
它的价值是回答「一个页面要怎么装配这个钱包模块」，并作为钱包层改动的快速回归入口。

| 文件 | 说明 |
| --- | --- |
| `src/App.jsx` | 演示页：包一层 `<WalletProvider>`，用 `useWalletContext()` 取状态，放 `NetworkBadge` + `ConnectWalletButton`，再把原始状态打成表格。 |
| `src/main.jsx` | 引入 `@wallet/styles/wallet.css` 与本地 `demo.css`，挂载 React。 |
| `src/styles/demo.css` | 只剩演示页自己的 `.kv`（状态表格）与 `.notes`（说明列表）。 |
| `vite.config.js` | 含 `@wallet` 别名。 |
| `README.md` | 该演示壳的说明 + 稳定文案/class 锚点清单。 |
| `e2e/run-wallet-login.mjs` | 跑真钱包 E2E；**转调**父仓库的 `e2e/wallet-login.mjs`，不复制代码。 |

> ⚠️ `wallet-login/` 与 `frontend/` **都监听 5173**，不能同时启动。跑 `wallet-login` 之前先停掉 `frontend` 的 dev server。

### 1.7 工程与协作配置

| 文件 | 说明 |
| --- | --- |
| `hardhat.config.js` | Hardhat 配置：`localhost`（31337）与 `sepolia` 两个网络，`sepolia` 从 `.env` 读 `DEPLOYER_PRIVATE_KEY`。 |
| `package.json` | 根目录脚本：`compile` / `test` / `node` / `deploy:*` / `smoke:*` / `export:remix`。 |
| `deployments/sepolia.json` | 部署产物（地址 + ABI），README 与验证脚本都引用它。 |
| `.env.example` | 根目录环境变量模板（`DEPLOYER_PRIVATE_KEY` / `TEST_CLAIMER_PRIVATE_KEY`）。**真实 `.env` 不入库。** |
| `CONTRIBUTING.md` | 环境准备、分支与提交规范、PR 与代码评审要求。 |
| `.github/` | CODEOWNERS、PR 模板、两个 Issue 模板、CI 流水线（合约测试 + 两个前端构建）。 |

### 1.8 链下 metadata 托管 `relay/` + `docs/` ★

NFT 的 `tokenURI` 只是一个**字符串**，指向一个必须能被公网 GET 到的 URL；合约里
`tokenURI = baseURI + tokenId + ".json"`（`contracts/TicketNFT.sol:139`）。
所以「让门票显示封面」本质上只有两个问题：**图片放哪儿**、**谁有权限往上放**。

| 文件 | 说明 |
| --- | --- |
| `relay/src/index.js` | Cloudflare Worker，单文件。`POST /upload` 验签后把封面 + metadata JSON 提交进 `docs/`；`GET /meta/<tokenId>.json` 是可选的动态路线 |
| `relay/test-local.mjs` | 本地测试。Worker 只用标准 Web API，所以能直接在 Node 22 里 `import` 当函数调用 —— **不需要 Cloudflare 账号、不需要部署** |
| `relay/upload-cover.mjs` | 命令行上传（走完全相同的 `/upload` 代码路径），并自动发 `updateEventURI`。**不部署 Worker 也能用** |
| `relay/部署.cmd` | Windows 双击完成 `wrangler login` → `secret put GITHUB_TOKEN` → `deploy` |
| `docs/index.html` | Pages 首页：逐个读 `events/event-*.json` 并渲染，等于按 NFT 阅读器的方式验证了一遍 `tokenURI` |
| `docs/images/` `docs/events/` | 封面与 metadata JSON 的实际存放位置（Pages 的站点根就是 `docs/`） |

**为什么 baseURI 以 `#` 结尾**：

```
baseURI      = https://scnu001.github.io/DAPP/events/event-3.json#
tokenURI(12) = https://scnu001.github.io/DAPP/events/event-3.json#12.json
                                                                  └── HTTP 请求时被忽略
```

`#` 之后的内容浏览器不会发给服务器，于是整场活动的每张票读**同一份**静态 JSON ——
读路径零依赖、不需要按 tokenId 预生成文件；而每张票的 `tokenURI` 字符串仍然互不相同
（`#12.json` vs `#13.json`），唯一性不受影响。代价是同一场活动的票共用一份 metadata
（名字里带不了各自的 tokenId，但钱包本来就会自己显示 `#12`）。

**兜底路线 `VITE_LOCAL_COVER=on`**：把封面只压进本机浏览器（localStorage），不签名、不上传、
不上链 —— 换来的是一份**离线也能演示的完整交互**（relay 未部署、或临时坏掉时不至于 Demo 开天窗）。
代价是链上 `baseURI` 仍为空、外部查看器看不到图，所以界面会同时打出「封面：本机（未上链）」
角标与顶部黄条 —— **这条路线绝不能冒充「metadata 已上链」**。默认关闭，一个环境变量即可切换。

详见 [`relay/README.md`](./relay/README.md) 与 [`docs/README.md`](./docs/README.md)。

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

### 2.2 共享钱包模块接口 `@wallet`

对外接口就是 `shared/wallet/src/index.js` 里 export 的东西。**只从这个入口 import**。

```js
import {
  // A. React 装配
  WalletProvider, useWalletContext, useWallet,
  // B. 现成组件（都只吃一个 wallet prop）
  ConnectWalletButton, NetworkBadge,
  // D. 链常量
  SEPOLIA_CHAIN_ID, SEPOLIA_CHAIN_ID_DEC, SEPOLIA_RPC_URL,
  SEPOLIA_EXPLORER_URL, SEPOLIA_NETWORK_PARAMS,
  // E. 无状态助手
  isSepolia, isUserRejection, friendlyWalletError, codeOf,
  shortAddress, explorerAddress,
} from "@wallet";
```

样式在项目自己的 CSS 顶部引入：

```css
@import "@wallet/styles/wallet.css";
```

#### 2.2.1 `useWallet()` / `useWalletContext()` 的返回值

两者返回**同一个结构**。区别只是 `useWallet()` 每次调用都新建一份状态（需要多实例时用），
`useWalletContext()` 取的是根部 `<WalletProvider>` 注入的那一份（常规用法）。

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

**状态机**：

```
loading ──┬─→ noMetaMask                        页面里没有 window.ethereum
          └─→ disconnected ⇄ connecting ─→ connected ⇄ wrongNetwork
                    ↑                        │
                    └────── disconnect ──────┘
```

**约定**：`window.ethereum` **只允许出现在 `shared/wallet/src/hooks/useWallet.js` 里**。
接业务**不要**往这个文件里加合约代码，要在它上层再包一层（本项目的 `useContract` + `useEvents`），
把 `provider` / `signer` 往下传 —— 这样「换合约」不动钱包模块，「换钱包」不动合约代码。

**事件监听**：`accountsChanged`（换账号 / 钱包锁定）与 `chainChanged`（换网络）在 **mount-only effect** 里注册、
卸载时 `removeListener`，依赖数组必须是 `[]` 类 —— 否则每次渲染都会重复解绑/绑定。换账号会作废旧 signer。

#### 2.2.2 `<WalletProvider>` 与现成组件

| 导出 | Props | 说明 |
| --- | --- | --- |
| `WalletProvider` | `{ children }` | 在页面根部包一层，把 `useWallet()` 的状态注入 Context。一个页面只需要包一次。 |
| `useWalletContext()` | — | 取 Context 里的钱包对象；不在 Provider 内会抛错（尽早暴露装配错误）。 |
| `ConnectWalletButton` | `{ wallet }` | 按 `status` 渲染「连接钱包 / 断开」或「安装 MetaMask」。锚点：`.account-addr` / `.inline-error`。 |
| `NetworkBadge` | `{ wallet }` | 显示当前网络；非 Sepolia 时给「切换到 Sepolia (0xaa36a7)」按钮。锚点：`.network-badge(.ok/.bad)`。 |

#### 2.2.3 链常量与无状态助手

| 导出 | 签名 / 值 | 说明 |
| --- | --- | --- |
| `SEPOLIA_CHAIN_ID` | `"0xaa36a7"` | EIP-3326 要求的十六进制形式。 |
| `SEPOLIA_CHAIN_ID_DEC` | `11155111` | 十进制，用于展示与比较。 |
| `SEPOLIA_RPC_URL` | `string` | 公共只读 RPC，默认 `https://ethereum-sepolia-rpc.publicnode.com`，可用 `VITE_SEPOLIA_RPC_URL` 覆盖。 |
| `SEPOLIA_EXPLORER_URL` | `"https://sepolia.etherscan.io"` | 浏览器基地址。 |
| `SEPOLIA_NETWORK_PARAMS` | `object` | `wallet_addEthereumChain` 的参数，处理 4902 时用。 |
| `isSepolia` | `(chainId) => boolean` | 容忍 `string` / `number` / `bigint` 三种类型与大小写。 |
| `isUserRejection` | `(err) => boolean` | 这次失败是不是「用户在钱包里点了拒绝」（code 4001 或文案命中）。 |
| `codeOf` | `(err) => number \| null` | 从 `err.code` / `err.error.code` / `err.info.error.code` 里挖出 EIP-1193 错误码。 |
| `friendlyWalletError` | `(err) => string` | 翻译顺序：错误码 → 用户拒绝文案 → Ethers `shortMessage` → 原始 `message`（超 160 字符截断）。**不含合约 revert。** |
| `shortAddress` | `(addr) => string` | `0x1234…abcd`。 |
| `explorerAddress` | `(addr) => string` | Etherscan 地址页链接。 |

内置的 EIP-1193 错误码表：

| 错误码 | 含义 |
| --- | --- |
| `4001` | 你在钱包里取消了这次操作 |
| `4100` | 钱包未授权（需要先连接钱包） |
| `4200` | 钱包不支持该方法 |
| `4900` | 钱包与节点断开连接 |
| `4901` | 钱包未连接到该网络 |
| `4902` | 钱包里还没有 Sepolia 这个网络（需先添加）→ 触发 `wallet_addEthereumChain` |

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

> ⚠️ 注意：**连接钱包 ≠ 登录**。这里没有 session、没有 token。一个来源只「连接」一次；
> 之后每笔**写操作**要的是**当次签名确认**，不是重新连接。

---

### 2.3 门票业务前端接口 `frontend/src/`

**这才是「在钱包接口之上实现 NFT 铸造与领取」的地方。**
业务层不碰 `window.ethereum`，只消费 2.2 的接口。

#### 2.3.1 `useContract(wallet)` — `src/hooks/useContract.js`

```js
const { readProvider, readContract, writeContract, contractReady } = useContract(wallet);
```

| 返回值 | 类型 | 说明 |
| --- | --- | --- |
| `readProvider` | `BrowserProvider \| JsonRpcProvider` | 已连钱包时用钱包的 provider，否则回落到公共 RPC —— 所以**没连钱包也能浏览活动列表**。 |
| `readContract` | `Contract \| null` | 只读合约实例；`CONTRACT_ADDRESS` 为空时为 `null`。 |
| `writeContract` | `Contract \| null` | 绑定 `wallet.signer` 的合约实例；未连接或地址未配置时为 `null`，UI 据此禁用写按钮。 |
| `contractReady` | `boolean` | 等价于 `Boolean(readContract)`。 |

#### 2.3.2 `useEvents({ wallet, readContract, writeContract })` — `src/hooks/useEvents.js`

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
  claim,           // (eventId) => Promise<{ tokenId, eventId } | null>  领取门票
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

写操作统一走内部的 `runTx`：先 `wallet.ensureSepolia()`（幂等，这一步用的是**钱包接口**）→ `send()` →
`setTx("pending", hash)` → `response.wait(1)` → 校验 `receipt.status === 1` → `refresh()`。
任何一步失败都会用 `decodeRevert()` 解析原因写入 `tx.reason`，然后原样抛出。

#### 2.3.3 `src/lib/contract.js` — 合约地址与 ABI

| 导出 | 类型 | 说明 |
| --- | --- | --- |
| `CONTRACT_ADDRESS` | `string` | 从 `VITE_CONTRACT_ADDRESS` 读取；未配置为空串（此时 `readContract` 为 `null`）。 |
| `TICKET_ABI` | `string[]` | Human-readable ABI（Ethers v6 支持）。与 2.1 的接口一一对应，**改动合约必须同步此数组**。 |

> 链常量（chainId / RPC / 浏览器 / 加链参数）**不在这个文件里**，统一从 `@wallet` 引入。

#### 2.3.4 `src/lib/events.js` — 回执日志解析

| 导出 | 签名 | 说明 |
| --- | --- | --- |
| `parseLogs` | `(contract, receipt) => ParsedLog[]` | 逐个 `parseLog` 并按 ABI 过滤，解析不了的跳过。**不要直接取 `logs[0]`** —— 回执里会有别的合约的日志。 |
| `findLog` | `(contract, receipt, name) => ParsedLog \| null` | 按事件名查找。 |
| `eventIdFromReceipt` | `(contract, receipt) => bigint \| null` | 取 `createEvent` 回执里的新 eventId。 |
| `claimFromReceipt` | `(contract, receipt) => { eventId, attendee, tokenId } \| null` | 取 `claim` 回执里的 tokenId。 |
| `fetchClaimers` | `async (contract, eventId, fromBlock = 0) => Claimer[]` | 用 `queryFilter` 拉某场活动的历史领取名单。公共 RPC 对区块区间有限制，活动量大时建议按部署区块分段查。 |

#### 2.3.5 `src/lib/errors.js` — 错误解码（业务层）

| 导出 | 签名 | 说明 |
| --- | --- | --- |
| `extractRevertData` | `(err) => string \| null` | 挖出原始 revert data。Ethers v6 在不同 provider 下 `err.data` 类型不同（MetaMask 是 hex 字符串，Hardhat 是对象），所以 `err.data` / `err.error.data` / `err.info.error.data` / `err.revert.data` 四处都试。 |
| `decodeRevert` | `(err, iface) => string` | 按优先级提取原因：`revert.args[0]` → `revert.name` → `reason` → `iface.parseError(rawData)` → `shortMessage` → `info.error.message`。 |
| `friendlyMessage` | `(reason) => string` | 按 2.1.7 的映射表翻译成中文；识别「用户拒绝」；认不出来则原样返回（超 160 字符截断）。 |

#### 2.3.6 `src/lib/format.js` — 业务格式化

| 导出 | 签名 | 说明 |
| --- | --- | --- |
| `shortAddress` | `(addr) => string` | 从 `@wallet` re-export（单一真源）。 |
| `explorerAddress` | `(addr) => string` | 从 `@wallet` re-export。 |
| `explorerTx` | `(hash) => string` | Etherscan 交易页链接。 |
| `explorerNft` | `(contract, tokenId) => string` | NFT 实例页：`/token/{contract}?a={tokenId}`。 |
| `explorerContract` | `(addr) => string` | 合约页（锚到源码 `#code`）。 |
| `formatTime` | `(seconds) => string` | `uint64` 秒 → 本地时间字符串；`0` 显示「不限制」。 |
| `toDatetimeLocal` | `(seconds) => string` | `0` → `""`，用于表单回显。 |
| `datetimeLocalToSeconds` | `(value) => number` | `datetime-local` 的值 → `uint64` 秒（本地时区）。 |

#### 2.3.7 `src/lib/multicall.js` — 批量只读调用（性能优化）

| 导出 | 签名 | 说明 |
| --- | --- | --- |
| `MULTICALL3_ADDRESS` | `string` | Multicall3 地址 `0xcA11bde05977b3631167028862bE2a173976CA11`，Sepolia 等多链同址，无需自己部署。 |
| `MULTICALL3_ABI` | `string[]` | 只含 `aggregate3`，**按只读声明为 `view`**。 |
| `multicallRead` | `(contract, calls) => Promise<unknown[]>` | 把 `[{ method, args }]` 打包成一次 `eth_call`，返回与入参一一对应的解码结果；失败时回退为逐个调用。 |

**为什么需要它。** Ethers v6 的 `JsonRpcProvider` 已在 HTTP 层做 JSON-RPC 批处理，所以读 N 个活动**不会**变成 N 次 HTTP 请求 —— 这一点是实测确认的，不要想当然。真正的成本是 **JSON-RPC 调用数随 N 线性增长**：免费 RPC 按调用数 / 计算单元计费，且批大小超过 `batchMaxCount`（默认 100）会被切成多个请求，部分公共 RPC 还会直接拒绝过大的批。

改前改后实测（`node scripts/bench-reads.mjs`）：

| 活动数 | 改前 HTTP / JSON-RPC | 改后 HTTP / JSON-RPC |
| --- | --- | --- |
| 12（当前） | 2 / 26 | 2 / **4** |
| 50 | 1 / 51 | 1 / **2** |
| 200 | 3 / 201 | 1 / **2** |
| 500 | 6 / 501 | 1 / **2** |

**两个实现要点（都实测踩过）**：

1. 合约里 `aggregate3` 声明为 `payable`。若照抄这个 ABI，ethers 会把它当写方法去 `eth_sendTransaction`，报 `UNSUPPORTED_OPERATION`。所以这里**故意按 `view` 声明** —— 编码与解码完全一致，只是让 ethers 走 `eth_call`。
2. `decodeFunctionResult` 返回的是「outputs 数组」。只有一个 output 时（元组返回值很常见）必须取 `[0]`，否则拿到的是包了一层的 `Result`，字段名取不到 —— 这个坑会让「两种写法结果不一致」的假象出现。

#### 2.3.8 `src/lib/localCover.js` · `src/lib/tokenMetadata.js` · `src/hooks/useTicketArt.js` — 封面来源与兜底模式

| 导出 | 签名 | 说明 |
| --- | --- | --- |
| `LOCAL_COVER_ENABLED` | `boolean` | 由 `VITE_LOCAL_COVER` 决定，取值为 `on / true / 1 / yes` 时为真，**默认关闭**。 |
| `shrinkImage` | `(file, { maxW?, maxH?, quality? }) => Promise<string>` | canvas 缩放重编码，默认 ≤ 960×600、`quality 0.82`；优先 WebP，浏览器不支持时回退 JPEG（靠 `out.startsWith("data:image/webp")` 判断）。 |
| `dataUrlBytes` | `(dataUrl) => number` | 由 base64 长度反推真实字节数（base64 每 4 字符 3 字节，再减 padding）。 |
| `loadLocalCovers` / `saveLocalCover` / `removeLocalCover` / `clearLocalCovers` | `(eventId[, src]) => …` | 本机封面缓存，键 `tkt:cover:<合约地址>:<eventId>`。`save` 在配额耗尽时抛带中文说明的错误。 |
| `toFetchable` | `(uri) => string` | `ipfs://` → `https://ipfs.io/ipfs/`，其余原样返回。 |
| `fetchTokenMetadata` | `(tokenUri) => Promise<object>` | 按 NFT 阅读器的方式 GET 那份 JSON，带会话内 `Map` 缓存。**故意不特殊处理 `#`** —— 浏览器本来就会在发请求前丢掉 fragment，不处理正好当作端到端证明。 |
| `useTicketArt` | `({ readContract, tokenId, localSrc }) => { state, image, doc? }` | 一张票的封面从哪儿来，优先级见下。 |

`useTicketArt` 的优先级本身就是「哪条路线更权威」的表达：

```
1. 本机缓存   → state: "local"                          已确认看得见（但不代表链上可读）
2. tokenURI   → fetch → 用那份 JSON 的 image → "chain"   ★ 这条才证明 metadata 真的上链可读
3. 都没有     → "empty"（baseURI 为空）/ "unreachable"（URL 取不到）
```

第 2 条完全不看前端自己的任何状态，所以**只要卡片能显出图，就说明 `tokenURI → JSON → image`
这条链真的通了**。只在「自己持有这张票」时才去拉（`EventCard` 传 `myTokenId`）——
12 张卡片各拉一次外部 JSON 既慢又没必要。

**兜底模式在做什么、不做什么** —— `VITE_LOCAL_COVER=on` 时两条路线的对照：

| | relay 模式（默认，路线 2） | 本机兜底（路线 0） |
| --- | --- | --- |
| 图片存放 | `docs/images/`（GitHub Pages 公网可取） | 只在本机浏览器 `localStorage` |
| 签名 / 上传 | 签名 + `POST /upload` | 都不做 |
| 发交易 | 发一笔 `updateEventURI`（花 gas） | **不发**，链上 `baseURI` 保持为空 |
| `tokenURI()` | Pages 上的 metadata URL | **空字符串** ⇒ 外部查看器看不到图 |
| 界面标注 | `封面：链上 metadata` | `封面：本机（未上链）` + 顶部黄条 |

它换来的是「relay 没部署、或部署坏了的时候，这份作业仍然能演示完整交互」；
代价必须写在界面上，而不是藏在文档里。

---

### 2.4 演示壳 `wallet-login/`

**没有自己的接口** —— 它只是 `@wallet` 的一个消费者，用来演示装配方式并做钱包层的回归入口。
页面上这几处是自动化测试的稳定锚点，改结构或改文案要同步更新脚本：

| 锚点 | 含义 |
| --- | --- |
| `.account-addr` | 连接成功后显示地址（`title` 属性上是完整地址） |
| `.network-badge` / `.network-badge.ok` / `.network-badge.bad` | 网络徽章与状态 |
| 唯一一条 `.banner-warn`，文案含「当前网络不是 Sepolia」 | 网络不对时的黄条 |
| `.inline-error` | 错误文案 |
| 「连接钱包」/「断开」/「切换到 Sepolia」按钮文字 | 三个操作入口 |

> 该模块的详细说明、状态机图与移植步骤见 [`shared/wallet/README.md`](./shared/wallet/README.md)，
> 演示壳的说明见 [`wallet-login/README.md`](./wallet-login/README.md)。

---

### 2.5 链下 metadata 服务 `relay/`

它**不是业务后端**：不碰合约状态、不持私钥、不做权限判断。权限判定始终在链上 ——
它把签名恢复出的地址与 `getEventInfo().organizer` 比对，自己只是**核对者**。

| 方法 | 路径 | 入参 | 返回 |
| --- | --- | --- | --- |
| `POST` | `/upload` | multipart：`eventId` + `timestamp` + `signature` + `image` | `{ ok, image, metadata, baseURI, commits, note }` |
| `GET` | `/meta/<tokenId>.json` | — | 该 token 的 metadata JSON（`cache-control: max-age=60`） |
| `GET` | `/health` | — | `{ ok, contract, pages, pagesDir, repo, githubTokenConfigured }` |

**`/upload` 的校验顺序**（每一步失败都给出明确原因，顺序即权限边界）：

| # | 检查 | 失败返回 |
| --- | --- | --- |
| 1 | 四个字段齐全 | `400` 缺少 eventId / timestamp / signature / image |
| 2 | `eventId` 匹配 `^\d+$` —— 它会参与拼仓库路径，不卡就能写仓库别的地方 | `400` |
| 3 | `abs(now − timestamp) ≤ 300s`（防重放） | `400` 签名已过期 |
| 4 | MIME 在 `png / jpeg / webp / gif` 允许列表里（**故意不收 SVG** —— SVG 能内嵌 `<script>`，而 Pages 是静态站） | `400` |
| 5 | 非空且 ≤ 2 MB | `400` / `413` |
| 6 | 链上 `getEventInfo(eventId).organizer != 0x0`（合约对不存在的活动返回零值结构体，不会 revert） | `404` |
| 7 | `verifyMessage("ticket-cover:<eventId>:<timestamp>", signature) == organizer` | `403` 签名与活动主办方不符 |

**前端对应的调用链**（`src/hooks/useCoverUpload.js`）：

```
wallet.ensureSepolia()                             幂等：已在本网立即返回
  → wallet.signer.signMessage("ticket-cover:…")    弹一次钱包确认；不上链、不花 gas
  → POST <VITE_RELAY_URL>/upload                   拿回 { image, metadata, baseURI }
  → writeContract.updateEventURI(eventId, baseURI) ★ 这一步才上链、才花 gas
```

两次钱包动作是**刻意分开**的：签名只证明「你是这场活动的主办方」，改状态的是那笔交易。

**为什么 PAT 不能放前端**：往仓库写文件 = 创建一个 commit，GitHub 没有免凭据的写接口；
而前端 JS 是公开下载的，Vite 里带 `VITE_` 前缀的变量还会被主动打进 bundle。
所以浏览器只出示**签名**，PAT 留在 Worker 的 `secret` 里 —— 两边各拿一半，谁都单独用不了。

**MVP 降级路径**：不注册 Cloudflare 也能完成同样的事 ——
`node relay/upload-cover.mjs <eventId> <图片路径>` 走的是**完全相同的 `/upload` 代码路径**，
只是把 PAT 从 secret 换成本机 `relay/.dev.vars`，把签名从钱包换成 `.env` 里的私钥。
差别只在「谁来点这个上传」。

**兜底路线（完全不依赖 relay）**：`frontend/.env` 里把 `VITE_LOCAL_COVER` 设为 `on`，
封面就改为「canvas 压缩 → `localStorage`」，不签名、不上传、不上链（接口与对照表见 2.3.8）。
默认 `off`；正式提交与录制 Demo 前应保持 `off` 并配好 `VITE_RELAY_URL`。

---

> 环境准备、启动命令、分支与提交规范、PR 与代码评审流程见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。

## 许可证

课程项目（COMP7610 Final Project），默认内部可见。如需指定开源协议请补充 `LICENSE` 文件。
