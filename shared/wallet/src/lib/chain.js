/**
 * chain.js —— 链常量。
 *
 * 这里**只有**链本身的信息（chainId / RPC / 浏览器 / 加链参数），
 * 不认识任何合约：没有 ABI，也没有合约地址。想换链只改这一个文件。
 */

/** Sepolia chainId：十六进制字符串（EIP-3326 wallet_switchEthereumChain 要求这种格式） */
export const SEPOLIA_CHAIN_ID = "0xaa36a7";
/** 十进制形式，用于展示与比较（不同来源给的 chainId 类型不一样，见 lib/errors.js 的 isSepolia） */
export const SEPOLIA_CHAIN_ID_DEC = 11155111;

/** 只读用的公共 RPC（免 key）。想让未连钱包的用户也能读链时用它 */
export const SEPOLIA_RPC_URL =
  import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

/** 区块链浏览器基地址（只拼 URL，不做任何网络请求） */
export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";

/** wallet_addEthereumChain 的参数 —— 处理 4902（钱包里没这条链）时用 */
export const SEPOLIA_NETWORK_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: "Sepolia Testnet",
  nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};
