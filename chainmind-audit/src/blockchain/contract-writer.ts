import { ethers } from "ethers";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { ReconRepository } from "../storage/recon-repository.js";
import { ReconciliationRecord } from "../storage/types.js";

export class ContractWriter {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private auditContract: ethers.Contract | null = null;
  private reconRepo: ReconRepository;
  private isProcessing = false;

  private readonly AUDIT_ABI = [
    "function recordReconciliation((bytes32 reconId, bytes32 txHashA, bytes32 txHashB, uint8 status, uint64 timestampA, uint64 timestampB, address sender, uint128 valueWei) rec) external",
    "function batchRecordReconciliations((bytes32 reconId, bytes32 txHashA, bytes32 txHashB, uint8 status, uint64 timestampA, uint64 timestampB, address sender, uint128 valueWei)[] records) external",
    "function recordCount() external view returns (uint256)",
  ];

  constructor(reconRepo: ReconRepository) {
    this.reconRepo = reconRepo;
    this.initContract();
  }

  private initContract(): void {
    if (
      config.auditorPrivateKey &&
      config.chainMindContractAddress &&
      ethers.isAddress(config.chainMindContractAddress)
    ) {
      try {
        this.provider = new ethers.JsonRpcProvider(config.sepoliaHttpUrl);
        this.wallet = new ethers.Wallet(config.auditorPrivateKey, this.provider);
        this.auditContract = new ethers.Contract(
          config.chainMindContractAddress,
          this.AUDIT_ABI,
          this.wallet
        );
        logger.info(
          { contract: config.chainMindContractAddress, wallet: this.wallet.address },
          "ContractWriter initialized with live on-chain signer"
        );
      } catch (err) {
        logger.warn({ err }, "Failed to initialize live contract signer, falling back to simulated anchoring");
      }
    } else {
      logger.info("ContractWriter running in simulated anchoring mode (no private key or contract configured)");
    }
  }

  private statusToUint8(status: string): number {
    switch (status) {
      case "MATCHED": return 0;
      case "FLAGGED_TIMEOUT": return 1;
      case "FLAGGED_DUPLICATE": return 2;
      case "FLAGGED_VALUE_MISMATCH": return 3;
      case "FLAGGED_INTENT_CONFLICT": return 4;
      default: return 0;
    }
  }

  async anchorBatch(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const unanchored = this.reconRepo.getUnanchoredRecords(config.batchSize);
      if (unanchored.length === 0) return;

      if (this.auditContract && this.wallet) {
        // Live on-chain batch anchor
        await this.anchorToLiveContract(unanchored);
      } else {
        // Simulated local anchor
        this.anchorLocally(unanchored);
      }
    } catch (err) {
      logger.error({ err }, "Error during on-chain anchoring batch");
    } finally {
      this.isProcessing = false;
    }
  }

  private async anchorToLiveContract(records: ReconciliationRecord[]): Promise<void> {
    try {
      const formattedRecords = records.map((r) => {
        let valueWeiBig = 0n;
        try {
          valueWeiBig = BigInt(r.value_a_wei || "0");
        } catch {
          valueWeiBig = 0n;
        }

        return {
          reconId: ethers.keccak256(ethers.toUtf8Bytes(r.id)),
          txHashA: r.tx_hash_a.padEnd(66, "0"),
          txHashB: r.tx_hash_b ? r.tx_hash_b.padEnd(66, "0") : ethers.ZeroHash,
          status: this.statusToUint8(r.status),
          timestampA: BigInt(r.timestamp_a),
          timestampB: BigInt(r.timestamp_b || 0),
          sender: ethers.isAddress(r.sender) ? r.sender : ethers.ZeroAddress,
          valueWei: valueWeiBig,
        };
      });

      logger.info({ batchSize: records.length }, "Submitting on-chain batch to ChainMindAudit contract");
      const tx = await this.auditContract!.batchRecordReconciliations(formattedRecords);

      const receipt = await tx.wait();
      logger.info({ txHash: receipt.hash, block: receipt.blockNumber }, "Successfully anchored batch on-chain");

      for (const record of records) {
        this.reconRepo.updateAnchorInfo(record.id, receipt.hash, receipt.blockNumber);
      }
    } catch (err) {
      logger.error({ err }, "Failed to anchor batch to live contract");
    }
  }

  private anchorLocally(records: ReconciliationRecord[]): void {
    const mockTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(`anchor-${records.map((r) => r.id).join("-")}-${Date.now()}`)
    );
    const mockBlock = 6500000 + Math.floor(Math.random() * 100);

    for (const record of records) {
      this.reconRepo.updateAnchorInfo(record.id, mockTxHash, mockBlock);
    }
    logger.info({ batchSize: records.length, mockTxHash }, "Simulated anchoring for audit records");
  }
}
