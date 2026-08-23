import { describe, it, expect } from "vitest";
import { ReconciliationMatcher } from "../../src/reconciliation/matcher.js";
import { NormalizedEvent } from "../../src/storage/types.js";

function createMockEvent(overrides: Partial<NormalizedEvent>): NormalizedEvent {
  return {
    id: "uuid-" + Math.random(),
    chain_id: 11155111,
    tx_hash: "0x" + Math.random().toString(16).slice(2).padEnd(64, "0"),
    block_number: 100,
    block_timestamp: 1724400000,
    sender: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    receiver: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
    value_wei: "1000000000000000000",
    input_data: null,
    function_selector: null,
    extracted_intent: "BRIDGE_INITIATE",
    intent_source: "LLM",
    confidence_score: 0.95,
    block_confirmations: 12,
    ingested_at: Date.now(),
    processed_at: Date.now(),
    recon_status: "PENDING",
    recon_record_id: null,
    ...overrides,
  };
}

describe("ReconciliationMatcher", () => {
  it("should match identical cross-chain transactions (Exact Match)", () => {
    const eventA = createMockEvent({
      chain_id: 11155111,
      sender: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      receiver: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
      value_wei: "1000000000000000000",
      block_timestamp: 1724400000,
    });

    const eventB = createMockEvent({
      chain_id: 17000,
      sender: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      receiver: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
      value_wei: "1000000000000000000",
      block_timestamp: 1724400030,
      extracted_intent: "BRIDGE_COMPLETE",
    });

    const match = ReconciliationMatcher.evaluateMatch(eventA, eventB);

    expect(match).not.toBeNull();
    expect(match!.matchType).toBe("EXACT");
    expect(match!.score).toBeGreaterThanOrEqual(0.9);
  });

  it("should support 1% slippage or bridge fee tolerance (Fuzzy Value)", () => {
    const eventA = createMockEvent({
      chain_id: 11155111,
      value_wei: "1000000000000000000", // 1.0 ETH
    });

    const eventB = createMockEvent({
      chain_id: 17000,
      value_wei: "995000000000000000", // 0.995 ETH (0.5% fee)
      block_timestamp: eventA.block_timestamp + 60,
    });

    const match = ReconciliationMatcher.evaluateMatch(eventA, eventB);

    expect(match).not.toBeNull();
    expect(match!.matchType).toBe("FUZZY_VALUE");
  });

  it("should reject transactions from different senders", () => {
    const eventA = createMockEvent({
      chain_id: 11155111,
      sender: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    });

    const eventB = createMockEvent({
      chain_id: 17000,
      sender: "0x0000000000000000000000000000000000000001",
    });

    const match = ReconciliationMatcher.evaluateMatch(eventA, eventB);
    expect(match).toBeNull();
  });

  it("should reject transactions on the same chain", () => {
    const eventA = createMockEvent({ chain_id: 11155111 });
    const eventB = createMockEvent({ chain_id: 11155111 });

    const match = ReconciliationMatcher.evaluateMatch(eventA, eventB);
    expect(match).toBeNull();
  });
});
