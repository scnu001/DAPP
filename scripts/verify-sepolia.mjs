/**
 * 只读核查 Sepolia 上已部署的 TicketNFT：合约存在性 / owner / name / symbol / 活动数 /
 * 以及每场活动的 name、minted/maxSupply、open。不发任何交易。
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, "..", "package.json"));
const { ethers } = require("ethers");

const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "sepolia.json"), "utf8"));
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const p = new ethers.JsonRpcProvider(RPC, 11155111);

const c = new ethers.Contract(
  dep.address,
  [
    "function owner() view returns (address)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function eventCount() view returns (uint256)",
    "function getEventInfo(uint256) view returns (tuple(string name,string baseURI,uint64 startAt,uint64 endAt,uint32 maxSupply,uint32 minted,bool open,address organizer))",
    "function ticketOf(uint256,address) view returns (uint256)",
  ],
  p
);

const net = await p.getNetwork();
const code = await p.getCode(dep.address);
console.log("network        :", net.name, net.chainId.toString());
console.log("contract       :", dep.address);
console.log("code bytes     :", (code.length - 2) / 2);
console.log("deploy block   :", dep.blockNumber, " deployTx:", dep.deployTxHash);
console.log("name/symbol    :", await c.name(), "/", await c.symbol());
console.log("owner()        :", await c.owner());
console.log("owner == deployer:", (await c.owner()).toLowerCase() === dep.deployer.toLowerCase());

const n = Number(await c.eventCount());
console.log("eventCount     :", n);
const ATT = "0xd40C8610d18119cd8C7A5B44Aaa2981cDC0b3E73";
for (let i = 1; i <= n; i++) {
  const e = await c.getEventInfo(i);
  const t = await c.ticketOf(i, ATT);
  console.log(
    `  #${i} ${e.name} | minted=${e.minted}/${e.maxSupply} open=${e.open} | 参与者ticketOf=${t.toString()} | organizer=${e.organizer.slice(0, 8)}`
  );
}
console.log("Sepolia 余额（主办方）:", ethers.formatEther(await p.getBalance(dep.deployer)), "ETH");
console.log("Sepolia 余额（参与者）:", ethers.formatEther(await p.getBalance(ATT)), "ETH");
