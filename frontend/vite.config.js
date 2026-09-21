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
    // 必须 dedupe：shared/wallet 在项目根之外，它 import 的 ethers 会沿目录向上找到
    // 仓库根目录的 node_modules/ethers（根是 Hardhat 项目，本来就装了 ethers），
    // 导致 ethers 被打进两份（白胖 + 两个副本的 Contract/Signer 实例可能对不上）。
    // dedupe 强制这些依赖统一从本项目的 node_modules 解析。
    dedupe: ["ethers", "react", "react-dom"],
  },
  server: {
    port: 5173,
    host: true,
  },
});
