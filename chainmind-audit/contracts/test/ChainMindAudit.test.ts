import { expect } from "chai";
import { ethers } from "hardhat";

describe("ChainMindAudit", function () {
  async function deployFixture() {
    const [auditor, other] = await ethers.getSigners();

    const ChainMindAudit = await ethers.getContractFactory("ChainMindAudit");
    const audit = await ChainMindAudit.deploy();

    return { audit, auditor, other };
  }

  describe("Deployment", function () {
    it("Should set the deployer as auditor", async function () {
      const { audit, auditor } = await deployFixture();
      expect(await audit.auditor()).to.equal(auditor.address);
    });

    it("Should start with zero record count", async function () {
      const { audit } = await deployFixture();
      expect(await audit.recordCount()).to.equal(0);
    });
  });

  describe("recordReconciliation", function () {
    it("Should emit ReconciliationRecorded event", async function () {
      const { audit, auditor } = await deployFixture();

      const reconId = ethers.keccak256(ethers.toUtf8Bytes("test-recon-1"));
      const txHashA = ethers.keccak256(ethers.toUtf8Bytes("tx-a"));
      const txHashB = ethers.keccak256(ethers.toUtf8Bytes("tx-b"));

      const record = {
        reconId,
        txHashA,
        txHashB,
        status: 0,
        timestampA: 1724400000n,
        timestampB: 1724400120n,
        sender: auditor.address,
        valueWei: ethers.parseEther("1"),
      };

      await expect(audit.recordReconciliation(record))
        .to.emit(audit, "ReconciliationRecorded")
        .withArgs(
          reconId,
          txHashA,
          txHashB,
          0,
          1724400000n,
          1724400120n,
          auditor.address,
          ethers.parseEther("1")
        );
    });

    it("Should increment recordCount", async function () {
      const { audit, auditor } = await deployFixture();

      const record = {
        reconId: ethers.keccak256(ethers.toUtf8Bytes("test-recon-1")),
        txHashA: ethers.keccak256(ethers.toUtf8Bytes("tx-a")),
        txHashB: ethers.keccak256(ethers.toUtf8Bytes("tx-b")),
        status: 0,
        timestampA: 1724400000n,
        timestampB: 1724400120n,
        sender: auditor.address,
        valueWei: ethers.parseEther("1"),
      };

      await audit.recordReconciliation(record);
      expect(await audit.recordCount()).to.equal(1);
    });

    it("Should reject non-auditor calls", async function () {
      const { audit, other } = await deployFixture();

      const record = {
        reconId: ethers.keccak256(ethers.toUtf8Bytes("test-recon-1")),
        txHashA: ethers.keccak256(ethers.toUtf8Bytes("tx-a")),
        txHashB: ethers.keccak256(ethers.toUtf8Bytes("tx-b")),
        status: 0,
        timestampA: 1724400000n,
        timestampB: 1724400120n,
        sender: other.address,
        valueWei: ethers.parseEther("1"),
      };

      await expect(
        audit.connect(other).recordReconciliation(record)
      ).to.be.revertedWith("ChainMindAudit: unauthorized");
    });
  });

  describe("batchRecordReconciliations", function () {
    it("Should record multiple reconciliations in one tx", async function () {
      const { audit, auditor } = await deployFixture();

      const records = [
        {
          reconId: ethers.keccak256(ethers.toUtf8Bytes("recon-1")),
          txHashA: ethers.keccak256(ethers.toUtf8Bytes("tx-a1")),
          txHashB: ethers.keccak256(ethers.toUtf8Bytes("tx-b1")),
          status: 0,
          timestampA: 1724400000n,
          timestampB: 1724400120n,
          sender: auditor.address,
          valueWei: ethers.parseEther("1"),
        },
        {
          reconId: ethers.keccak256(ethers.toUtf8Bytes("recon-2")),
          txHashA: ethers.keccak256(ethers.toUtf8Bytes("tx-a2")),
          txHashB: ethers.keccak256(ethers.toUtf8Bytes("tx-b2")),
          status: 1,
          timestampA: 1724400100n,
          timestampB: 0n,
          sender: auditor.address,
          valueWei: ethers.parseEther("2"),
        },
      ];

      const tx = await audit.batchRecordReconciliations(records);
      const receipt = await tx.wait();
      
      const reconEvents = receipt!.logs.filter(
        (log: any) => log.fragment?.name === "ReconciliationRecorded"
      );
      expect(reconEvents.length).to.equal(2);
      expect(await audit.recordCount()).to.equal(2);
    });
  });
});

describe("MockBridgeSender", function () {
  it("Should emit BridgeInitiated on bridge call", async function () {
    const [sender, receiver] = await ethers.getSigners();

    const MockBridgeSender = await ethers.getContractFactory("MockBridgeSender");
    const bridge = await MockBridgeSender.deploy();

    const value = ethers.parseEther("0.1");

    await expect(
      bridge.initiateBridge(receiver.address, 17000, { value })
    ).to.emit(bridge, "BridgeInitiated");
  });
});

describe("MockBridgeReceiver", function () {
  it("Should emit BridgeCompleted on completeBridge call", async function () {
    const [relayer, sender, receiver] = await ethers.getSigners();

    const MockBridgeReceiver = await ethers.getContractFactory("MockBridgeReceiver");
    const bridge = await MockBridgeReceiver.deploy();

    const bridgeRequestId = ethers.keccak256(ethers.toUtf8Bytes("bridge-1"));

    await expect(
      bridge.completeBridge(
        sender.address,
        receiver.address,
        ethers.parseEther("0.1"),
        11155111,
        bridgeRequestId
      )
    ).to.emit(bridge, "BridgeCompleted");
  });
});
