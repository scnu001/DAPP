# COMP7610 Final Project — Decentralized Ticket DApp

> 一个部署在 **Sepolia 测试网**上的去中心化门票 DApp：主办方开票（NFT 门票），参与者领取，
> **所有规则由智能合约强制执行，前端全程不接触私钥**。

[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22-yellow)](https://hardhat.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.x-4E5EE4)](https://docs.openzeppelin.com/contracts/5.x/)
[![Ethers](https://img.shields.io/badge/Ethers-6.x-2535a0)](https://docs.ethers.org/v6/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)
[![Network](https://img.shields.io/badge/Network-Sepolia%20(0xaa36a7)-8A2BE2)](https://sepolia.etherscan.io/)
[![Repo](https://img.shields.io/badge/GitHub-scnu001%2FDAPP-181717?logo=github)](https://github.com/scnu001/DAPP)

---

## 目录

- [一、项目简介与用途](#一项目简介与用途)
- [二、线上实例](#二线上实例)
- [三、技术栈](#三技术栈)
- [四、目录结构](#四目录结构)
- [五、环境依赖与安装步骤](#五环境依赖与安装步骤)
- [六、运行与构建](#六运行与构建)
- [七、合约接口](#七合约接口)
- [八、测试与质量保障](#八测试与质量保障)
- [九、分支与提交规范](#九分支与提交规范)
- [十、协作流程（Issue / PR / Code Review）](#十协作流程issue--pr--code-review)
- [十一、多人协作实操指南](#十一多人协作实操指南)
- [十二、常见问题（FAQ）](#十二常见问题faq)
- [十三、安全说明与已知限制](#十三安全说明与已知限制)
- [十四、团队分工模板](#十四团队分工模板)

---

## 一、项目简介与用途

### 它是什么

一个 **Web3 门票系统**。主办方在链上开一场活动并设定规则（票量上限、开票时间窗），
参与者用自己的钱包领取一张 **ERC-721 NFT 作为门票**。规则写在合约里，**不依赖任何中心化服务器**：

- 每张票是链上唯一、可验证、可转让的 NFT；
- 「每个地址每场活动只能领一张」由 `claimed[eventId][address]` 二维映射强制执行，前端改不了；
- 活动是否开放、是否售罄、是否已结束，全部由链上状态决定。

### 为什么做这个

课程要求覆盖「钱包登录 + NFT 铸造」两个模块。门票是个自然的落点：它同时需要
**身份（谁在领）**、**稀缺性（票量有限）**、**时间约束（何时能领）** 和 **角色权限（谁能开票）**，
能用最小合约把 Web3 的核心概念讲完整。

### 核心特性

| 特性 | 说明 |
| --- | --- |
| **钱包登录** | 只读 `window.ethereum`（EIP-1193），支持连接 / 刷新静默恢复 / 断开 / 一键切到 Sepolia / 换账号换网络自动同步 |
| **NFT 门票** | OpenZeppelin `ERC721` + `Ownable`，`_safeMint` 铸造，`tokenURI` 指向 metadata |
| **链上限制** | 仅 owner 可开票；每地址每活动限一张；票量上限；时间窗口；可提前闭场 |
| **双角色 UI** | 角色由链上 `owner()` 推导（不是用户在界面上选的）：主办方看到开票面板，参与者看到领票按钮 |
| **无后端** | 读操作走公共 RPC，写操作走钱包签名；没有服务器、没有数据库、没有私钥托管 |
| **只读可用** | 没连钱包也能用公共 RPC 浏览活动列表 |

### 适用与不适用

- ✅ 适合：课程演示、小规模活动发放入场凭证、Web3 钱包/NFT 教学样例。
- ❌ 不适合直接用于生产售票：没有支付、没有退款、没有实名/防女巫、metadata 若用 HTTPS 托管则内容可被替换。

---

## 二、线上实例

已部署到 **Sepolia**，可直接在 Etherscan 查看、可现场演示：

| 项 | 值 |
| --- | --- |
| 网络 | Sepolia Testnet（chainId `0xaa36a7` / `11155111`） |
| 合约地址 | [`0x567eC107b7abD99D1882476fb9336cc134de942f`](https://sepolia.etherscan.io/address/0x567eC107b7abD99D1882476fb9336cc134de942f) |
| 部署交易 | [`0x04f391cc61579a149734684122fc406a69270960506ba8b26027fe0f1b89facb`](https://sepolia.etherscan.io/tx/0x04f391cc61579a149734684122fc406a69270960506ba8b26027fe0f1b89facb) |
| 部署区块 | `11739230`（gasUsed 2,036,337） |
| 合约 owner / 主办方 | [`0xa168dA3C44f8Aa8251499A71082da584814C041C`](https://sepolia.etherscan.io/address/0xa168dA3C44f8Aa8251499A71082da584814C041C) |
| 测试参与者账户 | [`0xd40C8610d18119cd8C7A5B44Aaa2981cDC0b3E73`](https://sepolia.etherscan.io/address/0xd40C8610d18119cd8C7A5B44Aaa2981cDC0b3E73) |
| 名字 / 符号 | `COMP7610 Ticket` / `TKT` |
| 代码仓库 | <https://github.com/scnu001/DAPP>（`main` = 交付分支，`develop` = 集成分支）|

随时可跑只读自查（不发交易）：

```bash
node scripts/verify-sepolia.mjs
```

> ⚠️ **演示时必须用"干净 EOA"**。Sepolia 上 `0xf39F…` / `0x7099…` / `0x3C44…` / `0x90F7…` 这些
> 「著名 Hardhat 测试地址」已被 **EIP-7702 委托**给扫钱合约（`eth_getCode` 返回 `0xef0100 ‖ 实现地址`）。
> 后果：**转进去的 ETH 会被当场扫走（余额恒为 0），也收不了 ERC-721（`_safeMint` revert `ERC721InvalidReceiver`）**。
> 详见 [FAQ 第 5 条](#q5为什么不能用-0xf39f92266-这类-hardhat-测试地址在-sepolia-上实操)。

---

## 三、技术栈

技术选型**已锁定**，团队内不要换（换库会导致大量返工）：

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 合约 | Solidity `^0.8.20`（编译用 0.8.28）+ **OpenZeppelin v5** | `ERC721` + `Ownable` |
| 合约工具链 | **Hardhat 2.22** + `@nomicfoundation/hardhat-ethers` + Chai | 编译 / 测试 / 部署 |
| 链交互 | **Ethers.js v6**（`BrowserProvider` / `Contract` / `interface.parseLog`） | 前端唯一链库 |
| 前端 | **React 18 + Vite 5** | 无路由、无状态管理库，够用即止 |
| 钱包 | **MetaMask**（`window.ethereum`，EIP-1193） | 不引入 wagmi / web3-react |
| 网络 | **Sepolia**，`0xaa36a7` / `11155111` | 公共测试网 |

**明确不用**：Web3.js、Ethers v5 写法、OpenZeppelin v4、任何后端服务、任何私钥托管。

---

## 四、目录结构

```
comp7610-ticket-dapp/
├─ contracts/
│  └─ TicketNFT.sol            # 唯一合约：createEvent / claim / closeEvent / updateEventURI
├─ test/
│  └─ TicketNFT.test.js        # 13 个单元测试（本地内存链，2 秒跑完）
├─ scripts/
│  ├─ deploy.js                # 部署到指定网络，写 deployments/<network>.json
│  ├─ smoke.js                 # 本地链冒烟：建活动→领票→重复领取被拒→闭场
│  ├─ smoke-sepolia.js         # Sepolia 冒烟（用 .env 私钥签名）
│  ├─ verify-sepolia.mjs       # ★ 只读核查已部署实例（不发交易）
│  └─ export-remix.js          # 生成 remix/TicketNFT.sol（import 带版本号，可直接粘进 Remix）
├─ deployments/
│  └─ sepolia.json             # 部署产物：地址 + ABI（README 引用，必须入库）
├─ frontend/                   # 完整门票 DApp 前端
│  ├─ src/
│  │  ├─ hooks/
│  │  │  ├─ useWallet.js       # ★ 钱包登录：连接/静默恢复/切链/事件监听（唯一碰 window.ethereum 的地方）
│  │  │  ├─ useContract.js     # 只读 Provider 与 Signer 分离
│  │  │  └─ useEvents.js       # 活动数据 + 三个写操作的状态机
│  │  ├─ lib/
│  │  │  ├─ contract.js        # 链常量 + Human-readable ABI
│  │  │  ├─ errors.js          # revert 解码与中文提示
│  │  │  ├─ events.js          # receipt.logs + parseLog
│  │  │  └─ format.js          # 地址缩略 / Etherscan 链接 / 时间格式化
│  │  ├─ context/WalletContext.jsx
│  │  ├─ components/           # ConnectWalletButton / NetworkBadge / EventCard /
│  │  │                        # OrganizerPanel / AttendeePanel / TxStatus
│  │  ├─ styles/index.css
│  │  └─ App.jsx               # 组装 + 角色门禁（canWrite）
│  ├─ 启动本地服务.cmd          # Windows 双击即起 dev server（缺依赖会先 npm install）
│  └─ .env.example             # VITE_CONTRACT_ADDRESS / VITE_SEPOLIA_RPC_URL
├─ wallet-login/               # 「钱包登录」层单独抽出的可独立运行项目（无合约、无后端）
│  ├─ src/hooks/useWallet.js   # 与 frontend 里那份逐字一致，只改了 import 路径
│  ├─ src/components/          # ConnectWalletButton / NetworkBadge
│  ├─ src/lib/                 # chain / errors / format（已剔除 TICKET_ABI 与业务 revert 表）
│  ├─ src/App.jsx              # 演示页：组装组件 + 打印状态机原始值
│  └─ README.md                # 接口说明 / EIP-1193 用法表 / 移植步骤
├─ .env.example                # DEPLOYER_PRIVATE_KEY（根目录，只有合约脚本用）
├─ hardhat.config.js
├─ package.json
└─ README.md                   # 你正在看的这份
```

### 关于 `e2e/`（不在本仓库）

开发时我们写了 5 个**真实 MetaMask 端到端脚本**（`wallet-login.mjs`、`mint-flow.mjs`、
`mm-utils.mjs`、`debug-chainchange.mjs`、`open-manual-demo.mjs`），用真浏览器 + 真钱包扩展代替人工点击。
**它们按团队约定不随仓库分发**，原因见 [FAQ 第 11 条](#q11为什么仓库里没有-e2e-脚本)；
验证结果记录在[第八节](#八测试与质量保障)。

---

## 五、环境依赖与安装步骤

### 5.1 前置依赖

| 依赖 | 版本要求 | 用途 | 检查命令 |
| --- | --- | --- | --- |
| **Node.js** | **≥ 18**（建议 20 LTS 或 22） | 跑 Hardhat / Vite | `node -v` |
| **npm** | ≥ 9 | 装依赖 | `npm -v` |
| **git** | ≥ 2.30 | 版本管理 | `git --version` |
| **MetaMask** | 浏览器扩展 13.x | 连接钱包、签名交易 | 浏览器扩展页可见 |
| Sepolia ETH | ≥ 0.01 ETH | 付部署与领取的 gas | 见 [FAQ 第 10 条](#q10没有-sepolia-eth-去哪领) |
| 系统 Edge（可选） | 任意较新版本 | 仅真钱包 E2E 需要 | 已在仓库外 |

### 5.2 安装

```bash
# 1) 克隆
git clone https://github.com/scnu001/DAPP.git comp7610-ticket-dapp
cd comp7610-ticket-dapp

# 2) 合约依赖（根目录）
npm install

# 3) 配置部署私钥（仅本地，绝不提交）
cp .env.example .env
#   编辑 .env，填入 DEPLOYER_PRIVATE_KEY=0x...
#   ⚠️ 用专门的测试网小号，永远不要填持真实资产的账户私钥

# 4) 前端依赖
cd frontend
npm install
cp .env.example .env
#   编辑 .env，填 VITE_CONTRACT_ADDRESS（没有就先用下面第二节已部署的地址）

# 5) （可选）只想看钱包模块
cd ../wallet-login && npm install
```

### 5.3 装完自检

```bash
npm test                      # 期望 13 passing
cd frontend && npm run build  # 期望 built，无报错
```

---

## 六、运行与构建

### 6.1 合约

```bash
npm run compile            # 编译
npm test                   # 跑单元测试（13 个）
npm run node               # 起本地链 http://127.0.0.1:8545（另开一个终端）
npm run deploy:localhost   # 部署到本地链
npm run deploy:sepolia     # 部署到 Sepolia（需要 .env 里的私钥 + gas）
npm run smoke:localhost    # 本地链冒烟
npm run export:remix       # 生成 remix/TicketNFT.sol
```

部署成功后会打印地址并写入 `deployments/<network>.json`。把这个地址填进 `frontend/.env`：

```
VITE_CONTRACT_ADDRESS=0x...
```

### 6.2 前端

```bash
cd frontend
npm run dev       # 开发服务器 → http://127.0.0.1:5173/
npm run build     # 生产构建 → dist/
npm run preview   # 预览构建产物
```

Windows 上也可以直接双击 `frontend/启动本地服务.cmd`（依赖缺失会自动先装）。

> ⚠️ **`frontend/` 与 `wallet-login/` 都监听 5173，不能同时启动**（这是刻意的，为了让 E2E 脚本一行都不用改）。

### 6.3 钱包登录模块（独立版）

```bash
cd wallet-login
npm run dev       # → http://127.0.0.1:5173/
```

改链只改 `src/lib/chain.js` 里四个常量，其它文件不用动。

### 6.4 只读核查线上实例

```bash
node scripts/verify-sepolia.mjs
```

不指定任何参数即可跑，**不发任何交易**，交付前自查 / 答辩前确认状态时用。

---

## 七、合约接口

### 核心规则

- `createEvent(name, baseURI, startAt, endAt, maxSupply)` —— **仅 owner（主办方）** 可调用，发出 `EventCreated`。
- `claim(eventId)` —— 任何地址可调用，**每个地址每场活动限一张**，发出 `TicketClaimed`。
- `closeEvent(eventId)` —— 主办方闭场，停止发放，发出 `EventClosed`。
- `updateEventURI(eventId, baseURI)` —— 主办方补填/修改 metadata 基地址。
- `ticketOf(eventId, addr)` —— 直接返回该地址在该活动的 tokenId（`0` = 未持有），
  前端一次 `staticCall` 就能判断"领没领"。

### 事件

```solidity
event EventCreated (uint256 indexed eventId, address indexed organizer, string name, uint32 maxSupply, uint64 startAt, uint64 endAt);
event TicketClaimed(uint256 indexed eventId, address indexed attendee, uint256 indexed tokenId);
event EventClosed  (uint256 indexed eventId, uint32 totalMinted);
```

> 一个事件最多 3 个 `indexed`；`string` 不加 `indexed`（否则存的是 keccak 哈希，前端拿不回原文）。

### 存储布局

四个映射撑起全部状态：

| 映射 | 含义 |
| --- | --- |
| `_events[eventId]` | 活动本身（名称、baseURI、时间窗、票量、已铸造数、是否开放） |
| `ticketOf[eventId][addr]` | 某地址在某活动持有的 tokenId（0 = 没有） |
| `claimed[eventId][addr]` | 是否已领过（防重复领取） |
| `_eventOfToken[tokenId]` | tokenId 反查属于哪场活动 |

### 前端行为

| 场景 | 实现 |
| --- | --- |
| 点击连接 | `eth_requestAccounts` → `ensureSepolia()` → 建 provider/signer |
| 刷新后恢复 | mount 时 `eth_accounts`（**不弹窗**），已授权则自动恢复并显示地址 |
| 网络不对 | `wallet_switchEthereumChain`；`4902` → `wallet_addEthereumChain`；`4001` → 提示用户拒绝；切换后轮询 `eth_chainId` 复核 |
| 钱包内换账号 | `accountsChanged` → 重建 signer、清空上一账号的业务状态 |
| 钱包内换网络 | `chainChanged` → 重建 `BrowserProvider`，非 Sepolia 进入 `wrongNetwork` 并禁用写操作 |
| 地址展示 | `0x1234…abcd`，点击跳 Etherscan `/address/`；交易跳 `/tx/`；NFT 跳 `/token/{合约}?a={tokenId}` |
| 交易反馈 | submitting → pending(hash + 链接) → success / error（revert 原因翻译成中文） |
| 角色 | 由链上 `owner()` 推导，不是用户在 UI 上选的 |

---

## 八、测试与质量保障

三层验证，从快到慢：

### 8.1 单元测试（秒级，任何人可跑）

```bash
npm test        # 13 passing
```

覆盖：部署状态、`EventCreated` 与 eventId 自增、仅 owner 可开票、参数校验、领取成功、
一人一活动一张、跨活动可各领一张、售罄、时间窗口、闭场权限与闭场后不可领、
不存在活动的 revert、`tokenURI` 拼接、`updateEventURI` 权限。

### 8.2 Sepolia 冒烟（十秒级，用 Node 私钥签名）

```bash
node scripts/smoke-sepolia.js          # 或在受限环境用下面 FAQ 第 6 条的写法
```

实测结果（合约 `0x567e…942f`）：

```
createEvent: gas=125004 eventId=1
claim      : gas=148856 tokenId=1
ticketOf   : 1        ownerOf: 0xd40C…b3E73
tokenURI   : https://example.com/meta/1.json
重复领取    : ✅ revert → execution reverted: Ticket: already claimed
closeEvent : gas=30518 open=false
```

### 8.3 只读核查

```bash
node scripts/verify-sepolia.mjs
```

实测输出（2026-09-20）：

```
network        : sepolia 11155111
contract       : 0x567eC107b7abD99D1882476fb9336cc134de942f
code bytes     : 8605
deploy block   : 11739230
name/symbol    : COMP7610 Ticket / TKT
owner()        : 0xa168dA3C44f8Aa8251499A71082da584814C041C   (owner == deployer: true)
eventCount     : 4
  #1 Sepolia Smoke 1789841524619 | minted=1/10 open=false | 参与者ticketOf=1
  #2 E2E Concert 07:27:51        | minted=0/10 open=true  | 参与者ticketOf=0   ← 还开着，可现场演示领票
  #3 E2E Concert 07:33:31        | minted=1/10 open=false | 参与者ticketOf=2
  #4 E2E Concert 07:41:25        | minted=1/10 open=false | 参与者ticketOf=3
```

### 8.4 真实 MetaMask 端到端（开发期做过，脚本未随仓库分发）

用 Playwright 驱动**真实系统 Edge + MetaMask 13.49 扩展**，覆盖：

| 套件 | 检查项 | 结果 |
| --- | --- | --- |
| `wallet-login` | 全新 profile onboarding / 点击连接 + 真实授权弹窗 / Sepolia 校验 / **刷新静默恢复** / 切主网 → `wrongNetwork` 横幅 + 一键切回 / 换账号 | 5/5 ✅ |
| `mint-flow` | 主办方连接 + `owner()` 角色判定 / `createEvent` + `EventCreated` 解析 / 换参与者 `claim` + 「我的门票」面板 / 链上 `ticketOf`+`ownerOf`+`tokenURI` + 重复领取 revert / `closeEvent` 前端变「已关闭」 | 5/5 ✅ |
| `wallet-login`（对 `wallet-login/` 独立项目跑） | 同上六项 | 6/6 ✅（退出码 0，128s） |

实测 gas：主办方整场花费 **0.00016 ETH**，参与者 **0.00015 ETH**（Sepolia 约 1 gwei）。

### 8.5 手工验收清单（提 PR 前自己过一遍）

- [ ] `npm test` 全绿
- [ ] `cd frontend && npm run build` 无报错
- [ ] 连接钱包 → 地址正确显示 → 刷新页面**不需要**重新点连接
- [ ] 钱包切到主网 → 出现黄色横幅 → 点「切换到 Sepolia」能切回来
- [ ] 用 owner 账户能创建活动；用普通账户点创建**应该被拒绝并给出中文提示**
- [ ] 同一账户领两次 → 第二次提示「你已经领过这场活动的票了」

---

## 九、分支与提交规范

### 9.1 分支模型

采用精简版 Git Flow —— 只有两条长期分支，其余都是短命分支：

| 分支 | 作用 | 规则 |
| --- | --- | --- |
| `main` | **可交付 / 可演示**的稳定版本 | 🔒 受保护，**禁止直接 push**，只接受来自 `develop` 的 PR；每个里程碑打 tag |
| `develop` | 集成分支，日常合并目标 | 🔒 禁止直接 push，只接受 feature/fix 分支的 PR |
| `feature/<scope>-<描述>` | 新功能 | 例：`feature/contract-close-event` |
| `fix/<描述>` | 修 bug | 例：`fix/wallet-silent-recover` |
| `docs/<描述>` | 只改文档 | 例：`docs/readme-faq` |
| `chore/<描述>` | 构建/依赖/配置 | 例：`chore/bump-vite-5.4.1` |
| `release/x.y.z` | 发布准备（可选） | 只改版本号与 changelog，之后合入 `main` 并打 tag |

**命名要求**：全小写、连字符分隔、见名知意。禁止 `test`、`dev`、`abc`、`临时` 这类名字。

### 9.2 提交信息规范（Conventional Commits）

格式：

```
<type>(<scope>): <简短描述>

[可选正文：为什么这么改，而不是改了什么]

[可选脚注：Closes #12]
```

**type 取值**：

| type | 用途 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 只改文档 |
| `style` | 格式调整（不影响逻辑） |
| `refactor` | 重构（不改行为） |
| `perf` | 性能优化 |
| `test` | 增删改测试 |
| `build` | 构建系统 / 依赖 |
| `ci` | CI 配置 |
| `chore` | 杂项 |
| `revert` | 回滚 |

**scope 建议**（本项目）：`contract` / `frontend` / `wallet` / `scripts` / `docs` / `repo`

**示例**：

```
feat(contract): 支持主办方提前关闭活动

closeEvent 只允许 owner 调用，闭场后 claim 直接 revert。
新增 EventClosed 事件便于前端刷新。

Closes #7
```

```
fix(wallet): 刷新页面时误弹出连接窗口

改用 eth_accounts 做静默恢复，只有用户主动点击才走 eth_requestAccounts。
```

**要求**：一次提交只做一件事；禁止 `update`、`修改`、`fix bug`、`.` 这类无信息量的信息；
正文说明**为什么**（代码本身已经说明了"是什么"）。

### 9.3 提交前必查

```bash
git status                 # 确认没有把 .env / node_modules / 日志 加进来
npm test                   # 合约测试全绿
```

---

## 十、协作流程（Issue / PR / Code Review）

### 10.1 标准流程

```
Issue（描述问题/需求）
   ↓
从 develop 切出 feature 分支
   ↓
小步提交（Conventional Commits）
   ↓
push 到远程 + 开 PR（目标分支 develop）
   ↓
CI 自动跑测试 + 至少 1 人 Code Review
   ↓
Squash Merge 到 develop
   ↓
里程碑时 develop → main（PR）+ 打 tag v1.0.0
```

### 10.2 Issue

- **先搜后提**：提之前搜一下有没有重复的。
- 用模板（`.github/ISSUE_TEMPLATE/`）：`bug_report`（复现步骤 + 期望 vs 实际 + 环境）或 `feature_request`（要解决什么问题 + 验收标准）。
- 打标签：`bug` / `enhancement` / `docs` / `contract` / `frontend` / `wallet` / `question`。
- 指派负责人 + 设 milestone。**没有 issue 也能改代码，但改动超过 100 行请先开 issue 对齐方案**。

### 10.3 Pull Request

- 一个 PR 只解决一件事。**超过 400 行 diff 请拆**（评审质量会断崖式下降）。
- 必须填 PR 模板（`.github/PULL_REQUEST_TEMPLATE.md`）：改了什么 / 为什么 / 怎么验证 / 影响面 / 截图（UI 改动必须贴）。
- PR 标题也用 Conventional Commits 格式（squash 后会直接变成 commit message）。
- **自己不能 approve 自己的 PR**；不要 push 到别人的分支上（除非对方明确同意）。
- 合并前必须：① CI 全绿 ② 至少 1 个 approve ③ 无未解决的 review 评论。
- 合并方式统一用 **Squash and merge**（保持 `develop` 历史每个 PR 一条线）。

### 10.4 Code Review 看什么

按优先级（**合约 > 逻辑 > UI > 格式**）：

| 优先级 | 检查点 |
| --- | --- |
| 🔴 必查 | 合约：权限检查是否齐全、是否存在重入/整数问题、CEI 顺序、`indexed` 用法、gas 是否异常 |
| 🔴 必查 | 有没有硬编码私钥、把 `.env` 内容贴进代码或日志 |
| 🟠 应查 | 钱包层：只应在 `useWallet.js` 里出现 `window.ethereum`；事件监听是否 mount-only；换账号是否作废旧 signer |
| 🟠 应查 | 错误处理：revert 原因是否翻译成人类可读的中文 |
| 🟡 建议 | 命名、注释、是否重复代码、是否删掉了临时调试代码 |
| 🟡 建议 | 文档与实现是否一致（改了行为就要改 README） |

**评审礼仪**：

- 评论要具体、可执行：说清楚"改成什么"和"为什么"，不要只说"这里不好"。
- 区分 `blocking`（必须改）和 `nit`（可选）：`nit:` 前缀的评论不阻塞合并。
- 作者 24 小时内响应；不同意的评论先讨论达成一致，再改代码。
- 不要因为格式问题反复打回 —— 能靠工具（Prettier/ESLint）解决的交给工具。

### 10.5 分支保护与 CI 建议

在 GitHub 仓库 Settings → Branches 为 `main` 与 `develop` 添加保护规则：

- ✅ Require a pull request before merging（至少 1 个 approve）
- ✅ Require status checks to pass（选 `ci`）
- ✅ Dismiss stale approvals when new commits are pushed
- ❌ Allow force pushes / deletions

仓库已带一份最小 CI（`.github/workflows/ci.yml`）：push / PR 时自动跑
`npm test`（合约）与 `frontend` 的构建。如果课程不使用 GitHub Actions，可以删掉该文件。

---

## 十一、多人协作实操指南

### 11.1 第一次加入：5 分钟上手

```bash
git clone https://github.com/scnu001/DAPP.git comp7610-ticket-dapp && cd comp7610-ticket-dapp
npm install
cp .env.example .env          # 只有需要部署合约的人才需要填私钥
cd frontend && npm install && cp .env.example .env
```

`frontend/.env` 里 `VITE_CONTRACT_ADDRESS` **直接填 README 第二节那个已部署地址**，
这样所有人看到的是同一份链上数据，不需要各自部署。

**自检**：`npm test` 全绿 + `cd frontend && npm run dev` 能打开页面，就算环境好了。

### 11.2 每天的工作循环

```bash
git checkout develop && git pull                # 1. 同步
git checkout -b feature/wallet-xxx              # 2. 开分支
# ... 写代码、小步提交 ...
npm test && cd frontend && npm run build        # 3. 自测
git push -u origin feature/wallet-xxx           # 4. 推上去
# 5. 在 GitHub 开 PR → 等 review → 合并
git checkout develop && git pull                # 6. 回到 develop 同步
```

**保持分支新鲜**：如果 `develop` 更新了，先在自己的分支上 `git merge develop`（或 rebase），
**在本地解决冲突**，不要留给 reviewer。

### 11.3 按目录分工，从源头减少冲突

| 目录 | 主要负责人 | 说明 |
| --- | --- | --- |
| `contracts/` + `test/` | 合约同学 | 改动影响所有人，**改接口必须先开 issue 对齐** |
| `frontend/src/hooks/` | 钱包同学 | `useWallet.js` 是公共资产，改动需要额外 1 人 review |
| `frontend/src/components/` | UI 同学 | 冲突最少的区域，可以并行开工 |
| `wallet-login/` | 钱包同学 | 与 `frontend/` 逐字一致，**改了 `frontend` 的 `useWallet.js` 要同步过来** |
| `scripts/` / `deployments/` | 部署同学 | 部署后必须更新 `deployments/sepolia.json` 并在群里 announce 新地址 |
| `README.md` | 文档同学统稿 | 见下方约定 |

### 11.4 冲突高发文件与约定

| 文件 | 为什么容易冲突 | 约定 |
| --- | --- | --- |
| `package-lock.json` | 任何人加依赖都会整体重排 | **谁改了依赖谁负责解决冲突**（删掉重装：`rm -rf node_modules package-lock.json && npm install`），不要手改 |
| `README.md` | 多人同时编辑 | 每人只改自己负责的小节；大改前先在 issue 里说 |
| `frontend/src/App.jsx` | 组装文件，所有人都可能碰 | 改动尽量下沉到组件/hook；`App.jsx` 只做拼装 |
| `contracts/TicketNFT.sol` | 单一文件 | 同一时间**只能有一个人**在改合约；改完立刻通知全员同步 `useContract.js` 的 ABI |
| `wallet-login/src/hooks/useWallet.js` | 需要与 `frontend` 版本保持一致 | 改完一边，另一个 PR 里同步；用 diff 自查（见 11.3） |

### 11.5 同步节奏

- **每日**：站会同步三件事 —— 昨天做了什么 / 今天做什么 / 卡在哪。
- **每周**：把 `develop` 合到 `main`，打一个 tag（`v0.2.0` 这样），并更新 CHANGELOG（可选）。
- **里程碑**：部署一次到 Sepolia，全员更新 `frontend/.env` 里的合约地址。
- **交付前**：跑一遍 [8.5 手工验收清单](#85-手工验收清单提-pr-前自己过一遍)，并确认仓库里**没有 `.env`**。

### 11.6 新同学 onboarding 清单

- [ ] 能跑通 `npm test` 与 `cd frontend && npm run dev`
- [ ] 读过本 README 第七节（合约接口）与 `wallet-login/README.md`（钱包接口）
- [ ] 知道 `window.ethereum` 只允许出现在 `useWallet.js`
- [ ] 知道**永不提交 `.env`**、永不把私钥贴进代码/日志/Issue
- [ ] 在自己的分支上做过一次完整 PR 流程并被 review 通过

---

## 十二、常见问题（FAQ）

### Q1：刷新页面为什么不用重新点「连接钱包」？

因为钱包那边的**站点授权**还在。前端 mount 时调的是 `eth_accounts`（**静默、不弹窗**），
已授权就直接返回地址，所以能自动恢复。只有用户主动点击才走 `eth_requestAccounts`（会弹窗）。
注意：这不是前端做了持久化 —— 前端**没有**任何 token / localStorage 登录态。

### Q2：为什么「创建活动」按钮点了报「只有合约 owner 可以创建活动」？

`createEvent` 上有 `onlyOwner`。只有合约 owner
（`0xa168dA3C44f8Aa8251499A71082da584814C041C`）能开票。
请用该账户在 MetaMask 中连接；其它账户点了一定失败。这是**预期行为**，不是 bug。

### Q3：前端显示「未配置合约地址」怎么办？

`frontend/.env` 里的 `VITE_CONTRACT_ADDRESS` 没填或没重启 dev server。
填好后**必须重启** `npm run dev`（Vite 只在启动时读取 `.env`）。

### Q4：点了确认，但交易一直 pending 十几分钟？

Sepolia 公共节点在 baseFee 波动时可能把交易压在 mempool 里等更便宜的时刻，实测可等约 10 分钟。
判据是 `pending nonce > latest nonce`（说明有一笔挂着）。这**不是代码问题**，
想替换会报 `replacement fee too low`（说明费率本身不低，纯粹是打包时机）。
处理方式：在 MetaMask 里提高 gas 重发，或者耐心等；写自动化脚本时应**轮询链上状态**而不是等前端 UI。

### Q5：为什么不能用 `0xf39F…92266` 这类 Hardhat 测试地址在 Sepolia 上实操？

这些「著名 Hardhat 测试地址」在 Sepolia 上已被 **EIP-7702 委托**给扫钱合约
（`eth_getCode` 返回 `0xef0100 ‖ 实现地址`）。后果：

- 转 ETH 进去会被当场扫走（下一笔交易 gas 31,656/31,867，余额恒为 0）；
- 收不了 ERC-721（`_safeMint` revert `ERC721InvalidReceiver`）。

**本地链 31337 上它们是干净 EOA（所以本地测试全绿不代表测试网能跑）。**
任何要在公共测试网使用的账户，用之前先确认 `eth_getCode === "0x"` 并小额实测 `gasUsed === 21000`。

### Q6：`npx hardhat ...` 报错 / 被拦截怎么办？

某些受限环境会拦截 `npx`。绕过方式：直接调用 Hardhat 的 CLI 入口。

```bash
node node_modules/hardhat/internal/cli/cli.js test
node node_modules/hardhat/internal/cli/cli.js run scripts/deploy.js --network sepolia
```

`package.json` 里的 `npm run xxx` 脚本本来就是直接调 `hardhat`，所以用 `npm run` 一般不受影响。

### Q7：端口 5173 被占用 / 两个项目不能同时跑？

`frontend/` 与 `wallet-login/` **都刻意监听 5173**（为了让 E2E 脚本一行都不用改）。
跑其中一个之前先停掉另一个。查占用：

```bash
netstat -ano | findstr :5173        # Windows
lsof -i :5173                       # macOS / Linux
```

### Q8：私钥会不会被提交上去？`.env` 丢了怎么办？

**不会**。`.gitignore` 第 19 行明确排除 `.env`，只保留 `.env.example`。
提交前请用 `git status` 确认 `.env` 不在待提交列表里。

`.env` 丢了就重新 `cp .env.example .env` 并填入私钥。**私钥无法从链上或仓库里恢复** ——
如果丢了，就换一个新账户重新部署，并更新 README 第二节与 `frontend/.env`。

> 如果你**已经**误提交过私钥：立刻把那个账户的资产转走、作废该密钥，然后
> `git rm --cached .env` 并重写历史（`git filter-repo`）。**改完提交不够 —— 历史里还在。**

### Q9：怎么确认线上那个实例还活着？

```bash
node scripts/verify-sepolia.mjs
```

打印字节码长度（`code bytes` 不为 0 说明合约在）、`owner()`、每场活动的开放/售罄状态。不发交易。

### Q10：没有 Sepolia ETH 去哪领？

从 Sepolia 水龙头领（如 `sepoliafaucet.com`、Alchemy 的 Sepolia faucet）。
一次演示大概只需要 **0.001 ETH**（实测主办方整场 0.00016 ETH，参与者 0.00015 ETH）。

### Q11：为什么仓库里没有 `e2e/` 脚本？

那些脚本依赖**仓库外**的 MetaMask 扩展目录与特定版本的浏览器扩展，别人 clone 下来跑不动，
所以按团队约定不随仓库分发（脚本保留在开发者本机）。验证结论记录在
[第八节 8.4](#84-真实-metamask-端到端开发期做过脚本未随仓库分发)。
如果你想自己搭一套，思路是：用 Playwright 起一个带钱包扩展的持久化浏览器 profile，
把"解锁钱包 / 点确认 / 切网络 / 换账户"做成公共工具函数，再用它驱动前端页面断言。

### Q12：改了 `useWallet.js`，`wallet-login/` 那份要跟着改吗？

**要**。`wallet-login/src/hooks/useWallet.js` 与 `frontend/src/hooks/useWallet.js` 是**逐字一致**的
（只差一处 import 路径：`../lib/contract` ↔ `../lib/chain`）。改了任意一边，
在同一个 PR 里同步另一边，并手动 diff 确认只差那一行：

```bash
diff frontend/src/hooks/useWallet.js wallet-login/src/hooks/useWallet.js
```

---

## 十三、安全说明与已知限制

### 安全约定

- **私钥只出现在根目录 `.env`**（已 gitignore）。**前端永不接触私钥**，所有写操作由 MetaMask 签名。
- `.env` 里只用测试网小号，**永远不要填持真实资产的账户**。
- 交付 / 演示前请删除本地 `.env`。
- 不要把私钥贴进代码、日志、Issue、PR 描述或截图里。

### 已知限制（有意为之，不是 bug）

| 限制 | 说明 |
| --- | --- |
| 无支付 | 领票免费，没有定价、没有退款 |
| 无防女巫 | 只限制「一个地址一张」，多开钱包即可多领 |
| metadata 可替换 | 用 HTTPS 托管时域名持有者可随时改内容；生产应使用 `ipfs://<CID>` |
| 单合约单文件 | 145 行的 `TicketNFT.sol` 承载全部逻辑，未做模块化拆分 |
| 无升级机制 | 合约不可升级，改规则等于重新部署 |

---

## 十四、团队分工模板

| 成员 | 职责 | 主要目录 |
| --- | --- | --- |
| | 合约设计与实现 | `contracts/` `test/` |
| | 钱包登录模块 | `frontend/src/hooks/useWallet.js`、`wallet-login/` |
| | 铸造与双角色 UI | `frontend/src/components/` |
| | 部署、测试、README、Demo 视频与报告 | `scripts/` `deployments/` `README.md` |

### Demo 视频建议镜头

1. 连接钱包 → MetaMask 弹窗 → 地址缩略显示
2. 手动切到主网 → 黄色横幅 + 「切换到 Sepolia」→ 一键切回
3. 刷新页面 → 无需再点连接（静默恢复）
4. 主办方创建活动 → 新 eventId 立刻出现在页面（从 `EventCreated` 事件解析）
5. 地址 A 领取成功 → 再领一次 → 提示「你已经领过这场活动的票了」
6. 切到地址 B → 同一活动领取成功
7. Etherscan 上展示交易与 NFT

---

## 许可证

课程项目（COMP7610 Final Project），默认内部可见。如需指定开源协议请补充 `LICENSE` 文件。
