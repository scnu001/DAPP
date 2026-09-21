/**
 * contract.js —— **只有**合约相关的东西：部署地址 + ABI。
 *
 * 链常量（chainId / RPC / 浏览器 / 加链参数）已经搬到共享钱包模块，
 * 统一从 `@wallet` 引入 —— 钱包模块不认识合约，业务层也不该再自己维护一份链信息。
 *   需要链常量：import { SEPOLIA_CHAIN_ID, SEPOLIA_RPC_URL } from "@wallet";
 */

/** 部署后填进 frontend/.env 的 VITE_CONTRACT_ADDRESS */
export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS || "").trim();

/**
 * Human-readable ABI（Ethers v6 支持）。
 * 说明：outputs 的名字可省略；这里省略以免与主题索引产生歧义。
 */
export const TICKET_ABI = [
  // 写
  "function createEvent(string name, string baseURI, uint64 startAt, uint64 endAt, uint32 maxSupply) returns (uint256)",
  "function claim(uint256 eventId) returns (uint256)",
  "function closeEvent(uint256 eventId)",
  "function updateEventURI(uint256 eventId, string baseURI)",
  // 读
  // 注意：不能叫 getEvent —— Ethers v6 的 Contract 自带 getEvent() 方法，会撞名
  "function getEventInfo(uint256 eventId) view returns (tuple(string name, string baseURI, uint64 startAt, uint64 endAt, uint32 maxSupply, uint32 minted, bool open, address organizer))",
  "function eventCount() view returns (uint256)",
  "function eventOfToken(uint256 tokenId) view returns (uint256)",
  "function ticketOf(uint256 eventId, address account) view returns (uint256)",
  "function claimed(uint256 eventId, address account) view returns (bool)",
  "function nextEventId() view returns (uint256)",
  "function owner() view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  // 事件（string 不加 indexed：indexed 的动态类型只存哈希，前端拿不回原文）
  "event EventCreated(uint256 indexed eventId, address indexed organizer, string name, uint32 maxSupply, uint64 startAt, uint64 endAt)",
  "event TicketClaimed(uint256 indexed eventId, address indexed attendee, uint256 indexed tokenId)",
  "event EventClosed(uint256 indexed eventId, uint32 totalMinted)",
  "event EventURIUpdated(uint256 indexed eventId, string baseURI)",
];
