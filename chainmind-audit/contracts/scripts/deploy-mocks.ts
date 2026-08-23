import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Mock Bridge Contracts...");

  // Deploy MockBridgeSender
  const MockBridgeSender = await ethers.getContractFactory("MockBridgeSender");
  const sender = await MockBridgeSender.deploy();
  await sender.waitForDeployment();
  const senderAddr = await sender.getAddress();
  console.log(`MockBridgeSender deployed to: ${senderAddr}`);

  // Deploy MockBridgeReceiver
  const MockBridgeReceiver = await ethers.getContractFactory("MockBridgeReceiver");
  const receiver = await MockBridgeReceiver.deploy();
  await receiver.waitForDeployment();
  const receiverAddr = await receiver.getAddress();
  console.log(`MockBridgeReceiver deployed to: ${receiverAddr}`);

  console.log(`\nAdd to .env:`);
  console.log(`BRIDGE_SENDER_ADDRESS=${senderAddr}`);
  console.log(`BRIDGE_RECEIVER_ADDRESS=${receiverAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
