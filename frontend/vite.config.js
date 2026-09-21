import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// 共享钱包模块（单一真源）。两个前端项目都用同一个别名指向它。
// 用 fileURLToPath 而不是 new URL().pathname —— 中文路径下 pathname 会带 %E4%BD%9C 这类编码。
const walletSrc = fileURLToPath(new URL("../shared/wallet/src", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@wallet": walletSrc,
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
