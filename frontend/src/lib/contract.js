/**
 * 链上常量与 ABI —— 对应教程的 contract.js，但扩展成多活动版本。
 */

/** Sepolia chainId：十六进制字符串（EIP-3326 要求） */
export const SEPOLIA_CHAIN_ID = "0xaa36a7";
/** 十进制形式，用于展示/比对 */
export const SEPOLIA_CHAIN_ID_DEC = 11155111;

export const SEPOLIA_RPC_URL =
  import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";

/** 部署后填进 frontend/.env 的 VITE_CONTRACT_ADDRESS */
export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS || "").trim();

/** wallet_addEthereumChain 的参数（处理 4902） */
export const SEPOLIA_NETWORK_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: "Sepolia Testnet",
  nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

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
