# docs/ —— GitHub Pages 的发布根

这个目录**不是给构建用的**，它是 GitHub Pages 的站点根。仓库里 `docs/` 的内容会被原样挂到：

```
https://scnu001.github.io/DAPP/
```

（对应仓库 Settings → Pages → Source = `Deploy from a branch` / `main` / `/docs`）

## 目录约定

| 仓库路径 | 公网地址 | 谁写的 |
| --- | --- | --- |
| `docs/images/event-<id>.<ext>` | `https://scnu001.github.io/DAPP/images/event-<id>.<ext>` | relay Worker 的 `POST /upload`，或 `node relay/upload-cover.mjs` |
| `docs/events/event-<id>.json` | `https://scnu001.github.io/DAPP/events/event-<id>.json` | 同上（和图片同一次提交） |
| `docs/index.html` | 站点首页 | 手写，用来验证 metadata 真的可读 |
| `docs/app/`（可选） | 前端构建产物 | `node scripts/publish-frontend.mjs` |

## 为什么会存在这个目录

`contracts/TicketNFT.sol` 里：

```solidity
return string.concat(base, Strings.toString(tokenId), ".json");
```

`tokenURI` 除了拼字符串什么都不做 —— 图片和属性必须由链下的一个 URL 提供。
`baseURI` 以 `#` 结尾时：

```
baseURI      = https://scnu001.github.io/DAPP/events/event-3.json#
tokenURI(12) = https://scnu001.github.io/DAPP/events/event-3.json#12.json
                                                                  └── HTTP 请求时被忽略
```

于是每场活动只需要**一份** JSON，不需要按 tokenId 预生成，读路径也不依赖任何服务端。

## 为什么不用 raw.githubusercontent.com

图片放那儿确实也能下载，但那个域名不是给生产流量用的：限流严格、可能返回 `text/plain`
而不是 `image/png`、还带 `Content-Disposition`。不少 NFT 阅读器会因为 Content-Type 不对而判定图片无效。
Pages 是正常的静态站，Content-Type 正确、没有那层限流。

## 注意

- 提交到 `docs/` 之后 Pages 有 **30–60 秒**发布延迟，别刚提交就断言 404。
- 图片按 `eventId` 固定命名，换封面 = 覆盖同一个文件（Worker 会自动带上已有 `sha`）。
  如果换了图片格式（png → jpg），旧文件会留下来成为孤儿，因为路径变了；没人引用它，无害。
- `docs/` 是公开可读的（仓库本来就是 public），别往这里放任何私密内容。
