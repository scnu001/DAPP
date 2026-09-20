/**
 * 本地链的端到端冒烟：模拟「前端」的完整调用链
 *   createEvent → 用 EventCreated 解析 eventId
 *   claim       → 用 TicketClaimed 解析 tokenId
 *   ticketOf    → 一次 staticCall 判断某人领没领
 *
 * 用法：
 *   npx hardhat node                       （另一个终端）
 *   npm run deploy:localhost
 *   npx hardhat run scripts/smoke.js --network localhost
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

// 与 frontend/src/lib/events.js 里 findLog 的逻辑保持一致
function findLog(iface, receipt, name) {
  for (const log of receipt.logs) {
    let parsed = null;
    try {
      parsed = iface.parseLog({ topics: log.topics, data: log.data });
    } catch {
      continue;
    }
    if (parsed && parsed.name === name) return parsed;
  }
  return null;
}

async function main() {
  const networkName = process.env.HARDHAT_NETWORK || "localhost";
  const depFile = path.join(__dirname, "..", "deployments", `${networkName}.json`);
  if (!fs.existsSync(depFile)) {
    throw new Error(`找不到 ${depFile}，请先运行 npm run deploy:${networkName}`);
  }
  const dep = JSON.parse(fs.readFileSync(depFile, "utf8"));

  const [organizer, alice, bob] = await ethers.getSigners();
  const ticket = new ethers.Contract(dep.address, dep.abi, organizer);

  console.log("contract :", dep.address);
  console.log("organizer:", organizer.address);
  console.log("alice    :", alice.address);

  // 1) 主办方开票
  const tx1 = await ticket.createEvent("Smoke Concert", "https://example.com/meta/", 0, 0, 3);
  const r1 = await tx1.wait(1);
  const created = findLog(ticket.interface, r1, "EventCreated");
  const eventId = created.args.eventId;
  console.log(`\n[createEvent] eventId = ${eventId}（从 EventCreated 解析）`);
  console.log("            name     =", created.args.name);

  // 2) alice 领票
  const tx2 = await ticket.connect(alice).claim(eventId);
  const r2 = await tx2.wait(1);
  const claimed = findLog(ticket.interface, r2, "TicketClaimed");
  console.log(
    `\n[claim] alice tokenId = ${claimed.args.tokenId}（从 TicketClaimed 解析）gas=${r2.gasUsed}`
  );
  console.log("        ownerOf      =", await ticket.ownerOf(claimed.args.tokenId));
  console.log("        ticketOf     =", await ticket.ticketOf(eventId, alice.address));

// 与 frontend/src/lib/errors.js 的 extractRevertData 保持一致：
// err.data 在 MetaMask 下是 hex 字符串，在 Hardhat/JsonRpc 下是 { data, message, txHash } 对象
function extractRevertData(err) {
  const candidates = [err?.data, err?.error?.data, err?.info?.error?.data, err?.revert?.data];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("0x")) return c;
    if (c && typeof c === "object" && typeof c.data === "string" && c.data.startsWith("0x")) {
      return c.data;
    }
  }
  return null;
}

  // 3) alice 重复领取 —— 应该 revert
  try {
    await ticket.connect(alice).claim(eventId);
    console.log("\n[!] 重复领取竟然成功了，规则有问题");
  } catch (err) {
    const data = extractRevertData(err);
    let msg = err.shortMessage || err.message;
    if (data) {
      const decoded = ticket.interface.parseError(data);
      msg = decoded && decoded.name === "Error" ? decoded.args[0] : decoded ? decoded.name : msg;
    }
    console.log("\n[重复领取] 正确 revert：", msg);
  }

  // 4) bob 领票（同一活动不同地址）
  const tx4 = await ticket.connect(bob).claim(eventId);
  const r4 = await tx4.wait(1);
  const claimed2 = findLog(ticket.interface, r4, "TicketClaimed");
  console.log(`\n[claim] bob tokenId   = ${claimed2.args.tokenId} gas=${r4.gasUsed}`);

  // 5) 闭场
  const tx5 = await ticket.closeEvent(eventId);
  const r5 = await tx5.wait(1);
  const closed = findLog(ticket.interface, r5, "EventClosed");
  console.log(`\n[closeEvent] totalMinted = ${closed.args.totalMinted}`);

  // 6) 只读复核
  const info = await ticket.getEventInfo(eventId);
  console.log("\n[getEventInfo]", {
    name: info.name,
    maxSupply: Number(info.maxSupply),
    minted: Number(info.minted),
    open: info.open,
    organizer: info.organizer,
  });
  console.log("[tokenURI  ]", await ticket.tokenURI(1));
  console.log("\n✅ smoke passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
