import { describe, it, expect, beforeEach } from "vitest";
import { EventRepository } from "../../src/storage/event-repository.js";
import { ReconRepository } from "../../src/storage/recon-repository.js";
import { ReconciliationEngine } from "../../src/reconciliation/engine.js";
import { EventNormalizer } from "../../src/normalizer/normalizer.js";
import { IntentExtractor } from "../../src/ai/intent-extractor.js";
import { RawBlockchainEvent } from "../../src/listeners/types.js";

describe("ChainMind Audit End-to-End Pipeline", () => {
  let eventRepo: EventRepository;
  let reconRepo: ReconRepository;
  let engine: ReconciliationEngine;
  let intentExtractor: IntentExtractor;

  beforeEach(() => {
    eventRepo = new EventRepository();
    reconRepo = new ReconRepository();
    engine = new ReconciliationEngine(eventRepo, reconRepo);
    intentExtractor = new IntentExtractor();
  });

  it("should process and reconcile a full cross-chain swap pair end-to-end", async () => {
    const sender = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18";
    const receiver = "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4";
    const value = "1000000000000000000";
    const now = Math.floor(Date.now() / 1000);

    const randomSuffix = Math.random().toString(16).slice(2).padEnd(16, "0");
    const txHash1 = "0x" + "1".repeat(48) + randomSuffix;
    const txHash2 = "0x" + "2".repeat(48) + randomSuffix;

    // 1. Ingest Leg 1 (Sepolia BridgeInitiated)
    const rawLeg1: RawBlockchainEvent = {
      chainId: 11155111,
      txHash: txHash1,
      blockNumber: 1000,
      blockTimestamp: now,
      sender,
      receiver,
      valueWei: value,
      inputData: "0x8b95dd71000000000000000000000000",
      confirmations: 15,
    };
    const normLeg1 = EventNormalizer.normalize(rawLeg1);
    const inserted1 = eventRepo.insertEvent(normLeg1);
    expect(inserted1).toBe(true);

    const intent1 = await intentExtractor.extractIntent(normLeg1);
    eventRepo.updateEventIntent(normLeg1.id, intent1.intent, intent1.source, intent1.confidenceScore);

    // 2. Ingest Leg 2 (Chain B BridgeCompleted 10 seconds later)
    const rawLeg2: RawBlockchainEvent = {
      chainId: 17000,
      txHash: txHash2,
      blockNumber: 2000,
      blockTimestamp: now + 10,
      sender,
      receiver,
      valueWei: value,
      inputData: "0x4e71d92d000000000000000000000000",
      confirmations: 12,
    };
    const normLeg2 = EventNormalizer.normalize(rawLeg2);
    const inserted2 = eventRepo.insertEvent(normLeg2);
    expect(inserted2).toBe(true);

    const intent2 = await intentExtractor.extractIntent(normLeg2);
    eventRepo.updateEventIntent(normLeg2.id, intent2.intent, intent2.source, intent2.confidenceScore);

    // 3. Run reconciliation engine tick
    await engine.tick();

    // 4. Verify reconciliation record exists
    const recon = reconRepo.getReconciliationByTxHash(rawLeg1.txHash);
    expect(recon).not.toBeNull();
    expect(recon!.status).toBe("MATCHED");
    expect(recon!.match_type).toBe("EXACT");
    expect(recon!.sender.toLowerCase()).toBe(sender.toLowerCase());
    expect(recon!.timestamp_delta_s).toBe(10);

    // 5. Verify events status updated
    const updatedLeg1 = eventRepo.getEventById(normLeg1.id);
    const updatedLeg2 = eventRepo.getEventById(normLeg2.id);
    expect(updatedLeg1).not.toBeNull();
    expect(updatedLeg2).not.toBeNull();
    expect(updatedLeg1!.recon_status).toBe("MATCHED");
    expect(updatedLeg2!.recon_status).toBe("MATCHED");
  });
});
