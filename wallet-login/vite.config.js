import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// 共享钱包模块（单一真源）。原型里 wallet-login/src 曾把钱包层复制了一份，
// 现在改成 `@wallet` 别名指向 shared/wallet/src —— 这个项目只剩演示壳。
const walletSrc = fileURLToPath(new URL("../shared/wallet/src", import.meta.url));

// 端口与原门票 DApp 保持一致（5173）。
// ⚠️ 两个项目不能同时启动 —— 先关掉 `comp7610-ticket-dapp/frontend` 再跑这个。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@wallet": walletSrc,
    },
  },
  server: { host: "127.0.0.1", port: 5173, strictPort: false },
});
