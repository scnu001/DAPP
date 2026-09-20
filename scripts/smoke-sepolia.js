/**
 * Sepolia 冒烟：createEvent → claim → 重复领取 revert → closeEvent
 * 用法：node scripts/smoke-sepolia.js
 *
 * 与本地 scripts/smoke.js 的区别：这里连的是已部署到 Sepolia 的合约，
 * 账户用 .env 里的 DEPLOYER_PRIVATE_KEY（主办方）和 TEST_CLAIMER_PRIVATE_KEY（参与者）。
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const depPath = path.join(__dirname, "..", "deployments", "sepolia.json");

async function main() {
  if (!fs.existsSync(depPath)) throw new Error("缺少 deployments/sepolia.json，先 npm run deploy:sepolia");

  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
  const [organizer] = await ethers.getSigners();
  const claimerPk = process.env.TEST_CLAIMER_PRIVATE_KEY;
  if (!claimerPk) throw new Error(".env 缺少 TEST_CLAIMER_PRIVATE_KEY");

  const provider = ethers.provider;
  const claimer = new ethers.Wallet(claimerPk, provider);
  const ticket = await ethers.getContractAt("TicketNFT", dep.address, organizer);

  console.log("contract  :", dep.address);
  console.log("organizer :", organizer.address);
  console.log("claimer   :", claimer.address);
  console.log("eventCount:", (await ticket.eventCount()).toString());

  // 1) 创建活动
  const name = `Sepolia Smoke ${Date.now()}`;
  const tx1 = await ticket.createEvent(name, "https://example.com/meta/", 0, 0, 10);
  const r1 = await tx1.wait(1);
  const log1 = r1.logs
    .map((l) => {
      try {
        return ticket.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p && p.name === "EventCreated");
  const eventId = log1 ? Number(log1.args.eventId) : null;
  console.log(`createEvent: gas=${r1.gasUsed} eventId=${eventId}`);
  if (!eventId) throw new Error("没解析出 EventCreated");

  // 2) 参与者领取
  const tx2 = await ticket.connect(claimer).claim(eventId);
  const r2 = await tx2.wait(1);
  const log2 = r2.logs
    .map((l) => {
      try {
        return ticket.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p && p.name === "TicketClaimed");
  const tokenId = log2 ? log2.args.tokenId.toString() : null;
  console.log(`claim      : gas=${r2.gasUsed} tokenId=${tokenId}`);
  console.log(`ticketOf   : ${(await ticket.ticketOf(eventId, claimer.address)).toString()}`);
  console.log(`ownerOf    : ${await ticket.ownerOf(tokenId)}`);
  console.log(`tokenURI   : ${await ticket.tokenURI(tokenId)}`);

  // 3) 重复领取必须 revert
  try {
    await ticket.connect(claimer).claim.estimateGas(eventId);
    console.log("重复领取    : ⚠️ 没有 revert！");
  } catch (e) {
    const msg = e.shortMessage || e.reason || e.message;
    console.log(`重复领取    : ✅ revert → ${String(msg).slice(0, 120)}`);
  }

  // 4) 关闭活动
  const tx3 = await ticket.closeEvent(eventId);
  const r3 = await tx3.wait(1);
  const info = await ticket.getEventInfo(eventId);
  console.log(`closeEvent : gas=${r3.gasUsed} open=${info.open}`);
  console.log("\n✅ Sepolia 冒烟完成");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
