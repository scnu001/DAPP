require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

// Sepolia 公共 RPC（免 key），也支持在 .env 里覆盖 SEPOLIA_RPC_URL
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const networks = { hardhat: {} };

// 只配置了私钥才注册 sepolia 网络，避免 hardhat 启动时报缺参
if (DEPLOYER_PRIVATE_KEY) {
  networks.sepolia = {
    chainId: 11155111, // 0xaa36a7
    url: SEPOLIA_RPC_URL,
    accounts: [DEPLOYER_PRIVATE_KEY],
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    // OZ v5 的 ERC721 要求编译器 >= 0.8.24；0.8.28 依然满足合约里的 `pragma ^0.8.20`
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks,
  paths: {
    sources: "./contracts",
    tests: "./test",
    scripts: "./scripts",
    artifacts: "./artifacts",
    cache: "./cache",
  },
};
