import { describe, it, expect } from "vitest";
import { FallbackClassifier } from "../../src/ai/fallback-classifier.js";

describe("FallbackClassifier", () => {
  it("should classify initiateBridge selector accurately", () => {
    const result = FallbackClassifier.classify("0x8b95dd71", "1000000000000000000", null);
    expect(result.intent).toBe("BRIDGE_INITIATE");
    expect(result.source).toBe("RULE_BASED");
    expect(result.confidenceScore).toBeGreaterThan(0.9);
  });

  it("should classify completeBridge selector accurately", () => {
    const result = FallbackClassifier.classify("0x4e71d92d", "1000000000000000000", null);
    expect(result.intent).toBe("BRIDGE_COMPLETE");
  });

  it("should classify ERC20 transfer accurately", () => {
    const result = FallbackClassifier.classify("0xa9059cbb", "0", null);
    expect(result.intent).toBe("TRANSFER");
  });

  it("should classify Uniswap swap accurately", () => {
    const result = FallbackClassifier.classify("0x38ed1739", "0", null);
    expect(result.intent).toBe("SWAP");
  });

  it("should return UNKNOWN for unknown selector without crashing", () => {
    const result = FallbackClassifier.classify("0xdeadbeef", "0", null);
    expect(result.intent).toBe("UNKNOWN");
  });
});
