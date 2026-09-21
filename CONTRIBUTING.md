# 贡献指南（Contributing Guide）

感谢参与 COMP7610 Ticket DApp。这份文档说明**怎么在这个仓库里安全地改代码**。
项目背景、目录结构、运行方式请看 [`README.md`](./README.md)。

---

## 1. 环境准备

```bash
git clone https://github.com/scnu001/DAPP.git comp7610-ticket-dapp
cd comp7610-ticket-dapp
npm install
cp .env.example .env                    # 只有需要部署合约的人才填私钥
cd frontend && npm install && cp .env.example .env
```

`frontend/.env` 的 `VITE_CONTRACT_ADDRESS` **直接填 README 顶部表格里的已部署地址**，
这样全员看到同一份链上数据，不需要各自部署。

自检通过标准：

```bash
npm test                      # 13 passing
cd frontend && npm run build  # 无报错
```

> 💡 只想看钱包模块：`cd wallet-login && npm install && npm run dev`。
> 注意它和 `frontend` 都占 5173 端口，不能同时启动。

---

## 2. 开始改代码之前

| 改动规模 | 要做的事 |
| --- | --- |
| 改错别字 / 注释 | 直接开 PR |
| 改 bug、加小功能（< 100 行） | 可以直接开 PR，描述里说清楚动机 |
| 超过 100 行、或**改合约接口** | **先开 Issue 对齐方案**，拿到 👍 再动手 |
| 改技术栈 / 加依赖 | 先开 Issue，说明为什么现有方案不够 |

**改合约接口是高风险操作**：它会影响前端 ABI、`test/`、`scripts/`、README 里的文档。
一旦合并，所有人必须同步。

---

## 3. 分支与提交

### 开分支

```bash
git checkout develop
git pull
git checkout -b feature/<简短描述>     # 或 fix/xxx、docs/xxx、chore/xxx
```

分支命名：全小写 + 连字符，见名知意。禁止 `test`、`dev`、`abc` 这类无意义名字。

### 提交信息（Conventional Commits）

```
<type>(<scope>): <简短描述>
```

- `type`：`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`
- `scope`：`contract` `frontend` `wallet` `scripts` `docs` `repo`

示例：

```
feat(contract): 支持主办方提前关闭活动

closeEvent 只允许 owner 调用，闭场后 claim 直接 revert。

Closes #7
```

**一次提交只做一件事**；禁止 `update`／`修改`／`.` 这类无信息量的信息；正文写**为什么**。

### ❗ 提交前必查

```bash
git status        # 确认没有 .env / node_modules / *.log 混进来
npm test          # 全绿
```

**永不提交的东西**：

- `.env`（含私钥）、任何私钥/助记词文本
- `node_modules/`、`artifacts/`、`cache/`、`dist/`
- 浏览器 profile（`.edge-*`，单个 100MB+）、日志、截图等本地产物

---

## 4. 提 PR

1. `git push -u origin <你的分支>`
2. 在 GitHub 开 PR，**目标分支选 `develop`**（不是 `main`）
3. 填完 PR 模板：改了什么 / 为什么 / 怎么验证 / 影响面 / 截图（UI 改动必贴）
4. PR 标题也用 Conventional Commits 格式（squash 后会变成 commit message）
5. 等 CI 绿 + 至少 1 人 approve

### PR 自查清单

- [ ] 一个 PR 只解决一件事，diff 控制在 400 行以内
- [ ] `npm test` 全绿
- [ ] `cd frontend && npm run build` 无报错
- [ ] UI 改动：贴了改动前后的截图
- [ ] 行为有变 → 同步改了 README / 相关注释
- [ ] 没有把 `.env`、日志、临时调试代码带进来

### 合并

统一用 **Squash and merge**。合并后删掉远程分支。**不要自己 approve 自己**。

---

## 5. 代码评审

评审优先级：**合约 > 钱包层 > 业务逻辑 > UI > 格式**。

必查项：

- 合约：权限检查、CEI 顺序（先改状态再 `_safeMint`）、`indexed` 用法、gas 是否异常
- 安全：有没有硬编码私钥、有没有把敏感信息写进日志/注释
- 钱包层：`window.ethereum` **只允许出现在 `useWallet.js`**；事件监听必须 mount-only；
  换账号要作废旧 signer
- 错误处理：revert 原因是否翻译成人类可读的中文

评论礼仪：

- 说清楚「改成什么」和「为什么」，不要只说「这里不好」
- `nit:` 前缀表示可选建议，**不阻塞合并**
- 作者 24 小时内响应；有分歧先讨论达成一致再改
- 格式问题交给工具，不要用 review 反复打回

---

## 6. 容易踩的三个坑

1. **改了 `frontend/src/hooks/useWallet.js` 却忘了同步 `wallet-login/`**
   两份的**逻辑**必须一致。`diff` 正常会输出 7 行（1 行 import + 5 行抽出版特有的文件头注释 + 1 行空注释），
   出现其它差异才说明漂移。同一次提交里同步，并 `diff` 自查。

2. **`package-lock.json` 冲突**
   不要手改。删掉重装：`rm -rf node_modules package-lock.json && npm install`，
   谁改的依赖谁负责解决。

3. **改了合约却没更新前端 ABI**
   合约函数签名一变，`frontend/src/lib/contract.js` 里的 ABI 必须同步，
   否则运行时报「function not found」且很难定位。

---

## 7. 沟通

- 每日站会：昨天做了什么 / 今天做什么 / 卡在哪
- 阻塞超过半天就在群里说，不要自己憋着
- 部署了新合约 → **立刻**在群里 announce 地址，并更新 `deployments/sepolia.json`
