/**
 * chain.js —— 链常量（从门票 DApp 的 lib/contract.js 抽出，**已剔除合约 ABI 与合约地址**）
 *
 * 与原文件的唯一区别：这里没有 TICKET_ABI / CONTRACT_ADDRESS，因为钱包模块不认识任何合约。
 */

/** Sepolia chainId：十六进制字符串（EIP-3326 wallet_switchEthereumChain 要求这种格式） */
export const SEPOLIA_CHAIN_ID = "0xaa36a7";
/** 十进制形式，用于展示与比较（不同来源给的 chainId 类型不一样，见 lib/errors.js 的 isSepolia） */
export const SEPOLIA_CHAIN_ID_DEC = 11155111;

/** 只读用的公共 RPC（免 key）。想让未连钱包的用户也能读链时用它 */
export const SEPOLIA_RPC_URL =
  import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";

/** wallet_addEthereumChain 的参数 —— 处理 4902（钱包里没这条链）时用 */
export const SEPOLIA_NETWORK_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: "Sepolia Testnet",
  nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};
