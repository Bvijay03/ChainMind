import { describe, it, expect } from "vitest";
import { EventNormalizer } from "../../src/normalizer/normalizer.js";
import { RawBlockchainEvent } from "../../src/listeners/types.js";
import { normalizeAddress } from "../../src/utils/address.js";

describe("EventNormalizer", () => {
  it("should correctly normalize raw blockchain event to canonical schema", () => {
    const raw: RawBlockchainEvent = {
      chainId: 11155111,
      txHash: "0xABCDEF1234567890abcdef1234567890ABCDEF1234567890abcdef1234567890",
      blockNumber: 1234567,
      blockTimestamp: 1724400000,
      sender: "0x742d35cc6634c0532925a3b844bc9e7595f2bd18",
      receiver: "0x5b38da6a701c568545dcfcb03fcb875f56beddc4",
      valueWei: "1000000000000000000",
      inputData: "0x8b95dd71000000000000000000000000",
      confirmations: 12,
    };

    const normalized = EventNormalizer.normalize(raw);

    expect(normalized.id).toBeDefined();
    expect(normalized.chain_id).toBe(11155111);
    expect(normalized.tx_hash).toBe(raw.txHash.toLowerCase());
    expect(normalized.sender).toBe(normalizeAddress("0x742d35cc6634c0532925a3b844bc9e7595f2bd18"));
    expect(normalized.receiver).toBe(normalizeAddress("0x5b38da6a701c568545dcfcb03fcb875f56beddc4"));
    expect(normalized.function_selector).toBe("0x8b95dd71");
    expect(normalized.recon_status).toBe("PENDING");
    expect(normalized.block_confirmations).toBe(12);
  });
});
