const { ethers } = require("hardhat");
const { expect } = require("chai");

// 不依赖 hardhat-chai-matchers，自己写一个 revert 断言（少一个依赖 = 少一个版本冲突）
async function expectRevert(promise, msg) {
  let reverted = false;
  try {
    await promise;
  } catch (err) {
    reverted = true;
    expect(err.message).to.include(msg);
  }
  if (!reverted) throw new Error(`expected revert containing "${msg}", but tx succeeded`);
}

// 从 receipt 里解析事件（与前端 lib/events.js 的做法完全一致）
function findLog(contract, receipt, name) {
  for (const log of receipt.logs) {
    let parsed = null;
    try {
      parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
    } catch {
      continue;
    }
    if (parsed && parsed.name === name) return parsed;
  }
  return null;
}

describe("TicketNFT", () => {
  let ticket;
  let owner, organizer2, alice, bob;

  beforeEach(async () => {
    [owner, organizer2, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TicketNFT");
    ticket = await Factory.deploy();
    await ticket.waitForDeployment();
  });

  const createDefaultEvent = (from = owner, over = {}) =>
    ticket.connect(from).createEvent(
      over.name ?? "Web3 Concert",
      over.baseURI ?? "https://example.com/meta/",
      over.startAt ?? 0,
      over.endAt ?? 0,
      over.maxSupply ?? 10
    );

  it("部署后基础状态正确", async () => {
    expect(await ticket.name()).to.equal("COMP7610 Ticket");
    expect(await ticket.symbol()).to.equal("TKT");
    expect(await ticket.owner()).to.equal(owner.address);
    expect(await ticket.nextEventId()).to.equal(1n);
    expect(await ticket.eventCount()).to.equal(0n);
  });

  it("createEvent 发出 EventCreated，eventId 从 1 开始且自增", async () => {
    const tx = await createDefaultEvent();
    const receipt = await tx.wait(1);
    const log = findLog(ticket, receipt, "EventCreated");
    expect(log).to.not.equal(null);
    expect(log.args.eventId).to.equal(1n);
    expect(log.args.organizer).to.equal(owner.address);
    expect(log.args.name).to.equal("Web3 Concert");

    await createDefaultEvent();
    expect(await ticket.eventCount()).to.equal(2n);
    expect(await ticket.nextEventId()).to.equal(3n);
  });

  it("非 owner 不能创建活动", async () => {
    await expectRevert(createDefaultEvent(alice), "OwnableUnauthorizedAccount");
  });

  it("createEvent 参数校验：上限为 0 / 时间区间非法", async () => {
    await expectRevert(
      ticket.createEvent("x", "u", 0, 0, 0),
      "Ticket: zero supply"
    );
    await expectRevert(
      ticket.createEvent("x", "u", 200, 100, 5),
      "Ticket: bad time range"
    );
  });

  it("claim 成功：发出 TicketClaimed、写入 ticketOf、NFT 归属正确", async () => {
    await createDefaultEvent();
    const tx = await ticket.connect(alice).claim(1);
    const receipt = await tx.wait(1);

    const log = findLog(ticket, receipt, "TicketClaimed");
    expect(log).to.not.equal(null);
    expect(log.args.eventId).to.equal(1n);
    expect(log.args.attendee).to.equal(alice.address);
    expect(log.args.tokenId).to.equal(1n);

    expect(await ticket.ticketOf(1, alice.address)).to.equal(1n);
    expect(await ticket.claimed(1, alice.address)).to.equal(true);
    expect(await ticket.ownerOf(1)).to.equal(alice.address);
    expect(await ticket.eventOfToken(1)).to.equal(1n);

    const e = await ticket.getEventInfo(1);
    expect(e.minted).to.equal(1n);
  });

  it("一人一活动一张：同一地址重复领取会 revert", async () => {
    await createDefaultEvent();
    await ticket.connect(alice).claim(1);
    await expectRevert(ticket.connect(alice).claim(1), "Ticket: already claimed");
  });

  it("同一地址可以在不同活动各领一张（二维 claimed 与全局 hasMinted 的区别）", async () => {
    await createDefaultEvent();
    await createDefaultEvent();
    await ticket.connect(alice).claim(1);
    await ticket.connect(alice).claim(2);

    expect(await ticket.ticketOf(1, alice.address)).to.equal(1n);
    expect(await ticket.ticketOf(2, alice.address)).to.equal(2n);
    expect(await ticket.balanceOf(alice.address)).to.equal(2n);
  });

  it("超过上限后 sold out", async () => {
    await ticket.createEvent("Small", "u", 0, 0, 2);
    await ticket.connect(alice).claim(1);
    await ticket.connect(bob).claim(1);
    await expectRevert(ticket.connect(owner).claim(1), "Ticket: sold out");
  });

  it("时间窗口生效：未开始 / 已结束", async () => {
    const now = Math.floor(Date.now() / 1000);
    await ticket.createEvent("Timed", "u", BigInt(now + 3600), 0, 5);
    await expectRevert(ticket.connect(alice).claim(1), "Ticket: not started");

    // 结束时间已过
    await ticket.createEvent("Past", "u", BigInt(now - 7200), BigInt(now - 3600), 5);
    await expectRevert(ticket.connect(alice).claim(2), "Ticket: event ended");
  });

  it("closeEvent：非主办方不能关，关闭后不能再领", async () => {
    await createDefaultEvent();
    await expectRevert(ticket.connect(alice).closeEvent(1), "Ticket: not organizer");

    const tx = await ticket.connect(owner).closeEvent(1);
    const receipt = await tx.wait(1);
    const log = findLog(ticket, receipt, "EventClosed");
    expect(log).to.not.equal(null);
    expect((await ticket.getEventInfo(1)).open).to.equal(false);

    await expectRevert(ticket.connect(alice).claim(1), "Ticket: event closed");
    await expectRevert(ticket.connect(owner).closeEvent(1), "Ticket: already closed");
  });

  it("不存在的活动：claim / closeEvent 均 revert", async () => {
    await expectRevert(ticket.connect(alice).claim(99), "Ticket: event not found");
    await expectRevert(ticket.connect(owner).closeEvent(99), "Ticket: event not found");
  });

  it("tokenURI = baseURI + tokenId + .json；未设置 baseURI 返回空串", async () => {
    await createDefaultEvent();
    await ticket.connect(alice).claim(1);
    expect(await ticket.tokenURI(1)).to.equal("https://example.com/meta/1.json");

    await ticket.createEvent("NoURI", "", 0, 0, 3);
    await ticket.connect(alice).claim(2);
    expect(await ticket.tokenURI(2)).to.equal("");
  });

  it("updateEventURI：主办方可改，随后 tokenURI 跟着变", async () => {
    await createDefaultEvent();
    await ticket.connect(alice).claim(1);
    await expectRevert(ticket.connect(alice).updateEventURI(1, "ipfs://x/"), "Ticket: not organizer");

    await ticket.connect(owner).updateEventURI(1, "ipfs://QmABC/");
    expect(await ticket.tokenURI(1)).to.equal("ipfs://QmABC/1.json");
  });
});
