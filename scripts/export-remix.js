// 生成 remix/TicketNFT.sol：把 import 路径换成带版本号的形式
// （Remix 的 npm 解析器要求 @openzeppelin/contracts@<version>/...，而 Hardhat 用裸路径）
// 用法：npm run export:remix
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const ozVersion =
  (pkg.devDependencies["@openzeppelin/contracts"] || "").replace(/^\^|~/, "") || "5.0.2";

const installed = path.join(root, "node_modules", "@openzeppelin", "contracts", "package.json");
let realVersion = ozVersion;
if (fs.existsSync(installed)) {
  realVersion = JSON.parse(fs.readFileSync(installed, "utf8")).version;
}

const src = fs.readFileSync(path.join(root, "contracts", "TicketNFT.sol"), "utf8");
const out = src.replace(
  /@openzeppelin\/contracts\//g,
  `@openzeppelin/contracts@${realVersion}/`
);

const outDir = path.join(root, "remix");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "TicketNFT.sol");
fs.writeFileSync(outFile, out, "utf8");

console.log("OpenZeppelin version:", realVersion);
console.log("written:", outFile);
console.log("把这个文件内容整段粘进 Remix 即可编译（pragma 与 Hardhat 版完全一致）。");
