// 部署 TicketNFT 到指定网络，并把 {address, abi, network, deployTx} 写到 deployments/<network>.json
// 用法：
//   npm run deploy:localhost   （需先 npx hardhat node）
//   npm run deploy:sepolia     （需 .env 里配 DEPLOYER_PRIVATE_KEY）
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  const networkName = process.env.HARDHAT_NETWORK || (await ethers.provider.getNetwork()).name;
  const [deployer] = await ethers.getSigners();

  console.log("network   :", networkName);
  console.log("deployer  :", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("balance   :", ethers.formatEther(balance), "ETH");
  if (balance === 0n) throw new Error("deployer has no ETH");

  const Factory = await ethers.getContractFactory("TicketNFT");
  const ticket = await Factory.deploy();
  const deployTx = ticket.deploymentTransaction();
  console.log("deploy tx :", deployTx && deployTx.hash);

  await ticket.waitForDeployment();
  const address = await ticket.getAddress();
  console.log("TicketNFT :", address);

  const receipt = await deployTx.wait(1);
  console.log("block     :", receipt.blockNumber, "gasUsed:", receipt.gasUsed.toString());

  const artifact = await hre.artifacts.readArtifact("TicketNFT");

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${networkName}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        network: networkName,
        chainId: Number((await ethers.provider.getNetwork()).chainId),
        address,
        deployer: deployer.address,
        deployTxHash: deployTx.hash,
        blockNumber: receipt.blockNumber,
        abi: artifact.abi,
      },
      null,
      2
    )
  );

  console.log("written   :", outFile);
  console.log("\n把下面这行填进 frontend/.env：");
  console.log(`VITE_CONTRACT_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
