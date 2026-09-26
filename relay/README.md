# relay —— 门票 DApp 的最小上传 / 元数据服务

一个 Cloudflare Worker，单文件（`src/index.js`，约 210 行含注释）。
它**不持有任何钱包私钥**，不能签交易、不能动资产、不能改合约状态 —— 唯一的凭据是一份
只授权单个仓库 `contents:write` 的 GitHub PAT，存在 Worker 的 secret 里，永远不进代码库、不到前端。

## 为什么需要它

NFT 的 `tokenURI` 只是一个**字符串**，指向一个必须能被公网 GET 到的 URL。而合约里
`tokenURI = baseURI + tokenId + ".json"`（见 `contracts/TicketNFT.sol:139`）。于是有两个现实问题：

1. **图片得有个公网地址**。放本机没人访问得到，放 `raw.githubusercontent.com` 又限流、Content-Type 不可靠。
   → 让 GitHub Pages 托管。
2. **提交要凭据**。「往仓库写文件」= 创建一个 commit，GitHub 没有免凭据的写接口。
   而 PAT 一旦写进前端代码就等于公开（Vite 里 `VITE_` 前缀的变量还会被主动打进 bundle）。
   → PAT 只放在服务端 secret 里，浏览器只出示**签名**。

## 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/upload` | multipart：`eventId` + `timestamp` + `signature` + `image`。验签通过后提交两个文件到仓库，返回 `{ ok, image, metadata, baseURI }` |
| `GET` | `/meta/<tokenId>.json` | **可选**路线。收到请求才去链上 `eventOfToken` → `getEventInfo` 现场拼 JSON（详见下文「两条路线」） |
| `GET` | `/health` | 返回当前配置：合约地址、Pages 站点根、发布目录、是否已配 token |

`/upload` 是幂等的（按 `eventId` 固定路径，存在则带上 `sha` 覆盖），所以同一场活动换封面直接再传一次即可。

### `/upload` 做了什么

1. 参数守卫：`eventId` 必须匹配 `^\d+$`（它会参与拼仓库路径，不卡就能写仓库别的地方）、
   时间戳必须在 **300 秒**内（防重放）、类型必须在允许列表里
2. 大小上限 2 MB、拒绝空文件
3. 链上 `getEventInfo(eventId)`：`organizer == 0x0` 即视为活动不存在（合约对不存在的 event 返回零值结构体，不会 revert）
4. `verifyMessage("ticket-cover:<eventId>:<timestamp>", signature)` → 恢复出的地址必须等于链上 `organizer`
5. 提交两个文件到仓库（见下表），返回图片地址与 `baseURI`

**为什么不收 SVG**：SVG 里可以嵌 `<script>`，而 GitHub Pages 是静态站点，上传一个 SVG 相当于往自己的
域名下放可执行内容。允许列表只有 png / jpeg / webp / gif。

### 为什么是 `#` 结尾的 baseURI

```
baseURI      = https://scnu001.github.io/DAPP/events/event-3.json#
tokenURI(12) = https://scnu001.github.io/DAPP/events/event-3.json#12.json
                                                                  └── HTTP 请求时被忽略
```

`#` 之后的内容浏览器**不会发给服务器**，所以整场活动的每张票都读同一个静态 JSON：
读路径零依赖、不经过 Worker、不需要为每个 tokenId 预生成文件。
同时每张票的 `tokenURI` 字符串仍然互不相同（`#12.json` vs `#13.json`），唯一性不受影响。

代价：同一场活动的所有票共用一份 metadata（名字里带不了各自的 tokenId —— 钱包本来就会自己显示 `#12`）。

### 两条路线

| | A. 静态（推荐，前端默认） | B. 动态 |
| --- | --- | --- |
| `baseURI` | `/upload` 返回的 `.../events/event-N.json#` | `https://<relay>/meta/` |
| 谁提供 JSON | GitHub Pages 上的静态文件 | Worker 现场生成 |
| 阅读时依赖 Worker | **不依赖** | 依赖 |
| per-token 属性 | 共用一份 | 可带 `Token ID` 等独有字段 |
| 适合 | 正常交付 | 需要在浏览器里换前缀、或想让 Worker 统一兜底 |

路线 B 的实现是「先拉 A 的静态 JSON 当底稿，再补上 `Token ID` 属性」——
所以两条路线的图片与属性定义**只有一处真源**，不会两边各写一遍。
（`/meta` 里有一段自引用保护：`baseURI` 指向本站 `/meta/` 时不再去 fetch，否则会无限递归。）

### 路线 0：本机兜底（完全不经过 relay）

| | relay（路线 A / B） | 本机兜底（路线 0） |
| --- | --- | --- |
| 开关 | `frontend/.env` 里 `VITE_RELAY_URL` 有值 | `frontend/.env` 里 `VITE_LOCAL_COVER=on` |
| 封面存放 | 仓库 `docs/images/` | 浏览器 `localStorage` |
| 需要 PAT | 需要 | **不需要** |
| 需要 Cloudflare | 仅在选 B 时需要（A 可以直接用 `upload-cover.mjs`） | **不需要** |
| 链上 `baseURI` | 由 `updateEventURI` 写入 | 保持为空 ⇒ `tokenURI()` 返回 `""` |
| 外部查看器可见 | 可以（Pages 是公网） | **不可以**，只有本机这一台浏览器看得见 |

它存在的意义是「relay 还没配好、或临时坏掉时，这份作业仍然能演示完整交互」，
所以界面会同时打出「封面：本机（未上链）」角标与顶部黄条 —— 它**不冒充** metadata 已上链。
默认关闭；正式提交与录制 Demo 前应改回 `off` 并配好 `VITE_RELAY_URL`。
实现见 `frontend/src/lib/localCover.js` 与 `frontend/src/hooks/{useLocalCovers,useTicketArt}.js`。
自动化覆盖：`e2e/smoke-shared-wallet.mjs` 在兜底模式下的第 7 组场景（含「页面没有被异常打崩」一条）。

## 仓库里的文件

`wrangler.toml` 的 `PAGES_DIR` 决定发布目录（默认 `docs`）：

| 仓库路径 | 公网地址 |
| --- | --- |
| `docs/images/event-3.png` | `https://scnu001.github.io/DAPP/images/event-3.png` |
| `docs/events/event-3.json` | `https://scnu001.github.io/DAPP/events/event-3.json` |

`events/event-3.json` 内容（由 `/upload` 生成，图片扩展名按上传的 MIME 自动决定）：

```json
{
  "name": "Web3 Concert 2026 门票",
  "description": "Web3 Concert 2026 的入场门票，由 TicketNFT 合约在 Sepolia 上签发。",
  "image": "https://scnu001.github.io/DAPP/images/event-3.png",
  "attributes": [
    { "trait_type": "Event", "value": "Web3 Concert 2026" },
    { "trait_type": "Event ID", "value": 3 },
    { "trait_type": "Organizer", "value": "0xa168dA3C44f8Aa8251499A71082da584814C041C" }
  ]
}
```

## 信任模型

- **无权限判断**。relay 只是核对者：签名恢复出的地址 == 链上 `organizer`。权限来源始终是链上状态。
  换封面的权限想收回，只能在合约层面收回 —— relay 不引入新的权限概念。
- **无资产风险**。它不能签交易、不能转账。
- **PAT 的攻击面**：只能改 `scnu001/DAPP` 这一个公开仓库的文件内容。**丢了就立刻去 GitHub 撤销再建**。
- **单点**：路线 A 下 Worker 只在「上传那几秒」被用到，阅读不依赖它；路线 B 下它才是单点。
- `eventId` 参与拼路径 → 已用 `^\d+$` 卡死，避免 `../` 越界写。

## 本地跑（不需要 Cloudflare 账号、不需要 PAT）

Worker 的 handler 只用标准 Web API（`Request` / `Response` / `fetch` / `FormData` / `btoa`），
Node 22 原生就有，所以可以直接 `import` 进来当函数调用：

```bash
node relay/test-local.mjs        # 在仓库根目录执行
```

三个阶段：

- **A 守卫** —— 路由 / 404 / 上传参数校验（含路径注入型 `eventId`、SVG、不存在的活动）
- **B 验签** —— 随机假地址签名必须被 `403` 拒；真主办方签名（读根目录 `.env` 的 `DEPLOYER_PRIVATE_KEY`）
  必须**通过验签**并停在后一步
- **C 凭据** —— 若 `relay/.dev.vars` 里放了 `GITHUB_TOKEN`，用**只读**接口确认它真的有
  `contents:write`（`permissions.push === true`），不会提交任何文件

> A / B 两阶段刻意用**不带 token** 的 env，所以这个脚本永远不会真的往仓库写东西。

## 整链端到端（照样不需要 PAT、不需要 Cloudflare、不发交易）

```bash
node relay/test-e2e-local.mjs        # 38 项检查
# 或：cd relay && npm run test:e2e
```

上面那个脚本只测 Worker 自己的守卫与验签。这个则把**整条路线 2 跑通** ——
三个「外部世界」换成进程内的替身，中间全是真的：

```
前端的真实上传客户端            relay 的真实 Worker            假的 GitHub Contents API
frontend/src/lib/relay.js  →  relay/src/index.js         →  http://127.0.0.1:A
（真 fetch + 真 multipart）    （真验签 + 真 putFile）        （写临时目录；GET 返真 git blob sha，
                                                              PUT 带 sha 才算覆盖 —— 与真 GitHub 同语义）
                                                                   ↓
                                     本地静态服务器（扮演 GitHub Pages）http://127.0.0.1:B
                                                                   ↓
                            按 NFT 阅读器的方式取 tokenURI → JSON → image，逐个断言 200
```

它回答的是那些**只有真部署之后才会暴露**的问题：

- `baseURI` 以 `#` 结尾到底成不成立 —— 拿**带 fragment 的完整 tokenURI 字符串**去 fetch，
  三个不同 tokenId 都必须 200 且读到同一份 JSON；反证是「把 tokenId 直接拼进路径」时 Pages 上 404。
- 前端的 `coverSignMessage()` 与 Worker 验签用的字符串**是不是同一个**（两处各改一处就会失败）。
- Worker 有没有把 `GITHUB_TOKEN` 放进 `Authorization`（真 GitHub 没它会 401）。
- 覆盖已存在的文件时有没有带 `sha`（不带真 GitHub 会拒）。
- metadata JSON 的形状、`image` 是否可取、字节是否一致。

> 想调整替身的行为就改脚本里的 `ghServer` / `pagesServer`；
> `GITHUB_API` 这个 env 就是为它准备的（GitHub Enterprise 也用它）。
> 临时产物留在系统 temp 里（脚本末尾会打印路径），可以直接翻那个「仓库」。

## 部署（三步）

前置：一个免费 Cloudflare 账号（GitHub 登录即可）+ 一份 fine-grained PAT。

**PAT 怎么建**：GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token

- Repository access → `Only select repositories` → 勾 **`scnu001/DAPP`**
- Permissions → Repository permissions → **Contents = Read and write**（其余全 `No access`）
- Expiration 建议设到项目 DDL 之后（如 `2026-12-31`）

然后：

```bash
cd relay
npm install

# ⚠️ wrangler 会走环境变量里的代理。本机 HTTPS_PROXY 指向的端口到不了 Cloudflare，
#    先临时换成能用的那个（见根目录 MEMORY 里的记录），或者干脆清掉：
export HTTPS_PROXY=http://127.0.0.1:7890     # Windows CMD: set HTTPS_PROXY=http://127.0.0.1:7890

npx wrangler login                            # ① 浏览器里点授权
npx wrangler secret put GITHUB_TOKEN          # ② 粘贴 PAT，回车（值不会回显，也读不回来）
npx wrangler deploy                           # ③ 输出里会打印 Worker 的 https://…workers.dev 地址
```

部署完把那个地址写进 `frontend/.env`：

```
VITE_RELAY_URL=https://ticket-dapp-relay.<你的子域>.workers.dev
```

再重启 `npm run dev`，主办方控制台里就会出现封面上传。

Windows 上一键做 ②③ 可以直接双击 `relay/部署.cmd`。

## 部署后验证

```bash
RELAY=https://ticket-dapp-relay.<你的子域>.workers.dev

curl -s $RELAY/health
# {"ok":true,"contract":"0x567eC1…942f","pages":"https://scnu001.github.io/DAPP",
#  "pagesDir":"docs","repo":"scnu001/DAPP","githubApi":"https://api.github.com",
#  "githubTokenConfigured":true}

curl -s $RELAY/meta/12.json
# {"name":"Headless Mint 14:05:09 Ticket #12", …, "image":"https://scnu001.github.io/DAPP/images/event-12.png"}
```

上传则建议直接用前端界面（要真实钱包签名）—— 或者在本地用私钥跑：

```bash
node relay/upload-cover.mjs 3 path/to/cover.png     # 上传并自动发 updateEventURI
node relay/upload-cover.mjs --all  covers/          # 给所有活动批量补封面
```
