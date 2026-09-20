## 这个 PR 做了什么？

<!-- 一两句话说明。关联的 Issue 用 Closes #12 自动关闭 -->

Closes #

## 为什么这么改？

<!-- 动机 / 背景。代码本身说明了「是什么」，这里说「为什么」 -->

## 改动类型

- [ ] `feat` 新功能
- [ ] `fix` 修 bug
- [ ] `docs` 文档
- [ ] `refactor` 重构（不改行为）
- [ ] `test` 测试
- [ ] `chore` / `build` / `ci` 工程杂项

## 怎么验证的？

<!-- 写清楚 reviewer 照着做就能复现的步骤 -->

- [ ] `npm test` 全绿（13 passing）
- [ ] `cd frontend && npm run build` 无报错
- [ ] 手工验收：
      1.
      2.

## 影响面

- [ ] 改了**合约接口** → 已同步 `frontend/src/lib/contract.js` 的 ABI，并通知全员
- [ ] 改了 **`useWallet.js`** → 已同步 `wallet-login/src/hooks/useWallet.js`（并 diff 确认只差 import 一行）
- [ ] 改了**依赖** → `package-lock.json` 已一并提交
- [ ] 改了**行为** → 已更新 README / 注释
- [ ] 需要**重新部署合约**（说明新地址）：
- [ ] 无影响

## 截图（UI 改动必填）

| 改动前 | 改动后 |
| --- | --- |
| | |

## 自查

- [ ] 一个 PR 只解决一件事，diff 在 400 行以内
- [ ] 没有把 `.env` / 私钥 / 日志 / 临时调试代码带进来
- [ ] commit message 符合 Conventional Commits
