/**
 * publish-frontend.mjs —— 把前端的 vite build 产物发布到 GitHub Pages。
 *
 * 产物会被放到 `docs/app/`，也就是 Pages 站点根下的 /app/：
 *     https://scnu001.github.io/DAPP/app/
 *
 * 于是整条链路上没有任何应用服务器：
 *   Pages 托管前端静态文件  ·  Pages 也托管 NFT metadata  ·  前端直连公共 RPC 读链
 *   唯一的服务端是 relay Worker，而且只在「上传封面」那几秒被用到
 *
 * 用法（在仓库根目录）：
 *   node scripts/publish-frontend.mjs
 *
 * 注意：VITE_ 开头的变量是**构建期**打进产物的，所以改完 frontend/.env
 *       必须重新跑一次这个脚本，线上才会生效。
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const FRONTEND = path.join(ROOT, "frontend");
const DIST = path.join(FRONTEND, "dist");
const APP = path.join(ROOT, "docs", "app");

const PAGES_BASE = "https://scnu001.github.io/DAPP";

/* ---------------------------- 构建前先看一眼配置 ---------------------------- */

const envFile = path.join(FRONTEND, ".env");
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
const pick = (key) => (env.match(new RegExp(`^${key}=(.*)$`, "m")) || [, ""])[1].trim();

const contract = pick("VITE_CONTRACT_ADDRESS");
const relay = pick("VITE_RELAY_URL");

if (!contract) {
  console.error("✗ frontend/.env 里没有 VITE_CONTRACT_ADDRESS —— 线上会显示「未配置合约地址」。");
  process.exit(1);
}
console.log(`合约地址      ${contract}`);
console.log(`relay 地址    ${relay || "（空 → 线上没有封面上传功能）"}`);

// 本地地址打进线上产物是没意义的，提前拦一下
if (relay && /^https?:\/\/(127\.0\.0\.1|localhost)/.test(relay)) {
  console.error("✗ VITE_RELAY_URL 指向本机 —— 部署到 Pages 之前要换成 Worker 的公网地址。");
  process.exit(1);
}

/* -------------------------------- 构建 -------------------------------- */

console.log("\n[1/2] vite build ...");
const vite = path.join(FRONTEND, "node_modules", "vite", "bin", "vite.js");
if (!fs.existsSync(vite)) {
  console.error(`✗ 找不到 ${vite} —— 先在 frontend/ 里跑 npm install。`);
  process.exit(1);
}
// ★ 必须把 cwd 切到项目根再跑，`vite build --root` 不是合法选项（Vite 5 会报 checkUnknownOptions）
const built = spawnSync(process.execPath, [vite, "build"], { cwd: FRONTEND, stdio: "inherit" });
if (built.status !== 0) {
  console.error("✗ 构建失败。");
  process.exit(1);
}
if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error(`✗ 构建结束但 ${DIST}/index.html 不存在。`);
  process.exit(1);
}

/* ------------------------------- 拷贝到 docs ------------------------------- */

console.log(`\n[2/2] 复制 ${path.relative(ROOT, DIST)} → docs/app ...`);
const countFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce(
    (n, e) => n + (e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1),
    0
  );

if (fs.existsSync(APP)) {
  // 只删我们要覆盖的这个目录，而且先数一下文件数 —— 数量异常就先停下问人
  const n = countFiles(APP);
  if (n > 60) {
    console.error(`✗ docs/app 里有 ${n} 个文件，比预期多得多。为避免误删，请手动确认后再跑。`);
    process.exit(1);
  }
  fs.rmSync(APP, { recursive: true, force: true });
}
fs.cpSync(DIST, APP, { recursive: true });

// Vite 默认用绝对路径 /assets/... 引用资源，挂在子目录下会 404。
// 这里同时写. nojekyll 并检查 base 配置，免得白跑一趟。
const html = fs.readFileSync(path.join(APP, "index.html"), "utf8");
if (/(src|href)="\/assets\//.test(html)) {
  console.error(
    "\n✗ 产物里用的是 /assets/ 绝对路径 —— 挂在 /DAPP/app/ 下会 404。\n" +
      "  在 frontend/vite.config.js 里加：  base: '/DAPP/app/',  然后重新构建。"
  );
  process.exit(1);
}

const files = countFiles(APP);
console.log(`\n✓ 已复制 ${files} 个文件到 docs/app/`);
console.log(`  提交并推送后访问：${PAGES_BASE}/app/`);
console.log("  （GitHub Pages 发布有 30-60 秒延迟；VITE_ 变量是构建期烘焙的，改 .env 要重跑本脚本）");
