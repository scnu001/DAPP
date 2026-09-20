import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 端口与原门票 DApp 保持一致（5173）。
// ⚠️ 两个项目不能同时启动 —— 先关掉 `comp7610-ticket-dapp/frontend` 再跑这个。
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: false },
});
