import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
// 钱包模块自带的样式（token / 骨架 / 按钮 / 徽章 / 横幅）
import "@wallet/styles/wallet.css";
// 本演示壳自己的样式（状态表格、说明列表）
import "./styles/demo.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
