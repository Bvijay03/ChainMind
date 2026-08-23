import { ethers } from "hardhat";

async function main() {
  console.log("Deploying ChainMindAudit...");

  const ChainMindAudit = await ethers.getContractFactory("ChainMindAudit");
  const audit = await ChainMindAudit.deploy();
  await audit.waitForDeployment();

  const address = await audit.getAddress();
  console.log(`ChainMindAudit deployed to: ${address}`);
  console.log(`Auditor address: ${await audit.auditor()}`);
  console.log(`\nAdd to .env:\nCHAINMIND_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
