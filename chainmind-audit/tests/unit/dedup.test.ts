import { describe, it, expect, beforeEach } from "vitest";
import { EventDeduplicator } from "../../src/normalizer/dedup.js";

describe("EventDeduplicator", () => {
  let dedup: EventDeduplicator;

  beforeEach(() => {
    dedup = new EventDeduplicator(30);
  });

  it("should allow first-time event through", () => {
    const isDup = dedup.isDuplicate(11155111, "0x1234567890abcdef");
    expect(isDup).toBe(false);
  });

  it("should identify and flag second occurrence as duplicate", () => {
    dedup.isDuplicate(11155111, "0x1234567890abcdef");
    const isDup = dedup.isDuplicate(11155111, "0x1234567890abcdef");
    expect(isDup).toBe(true);
  });

  it("should be case-insensitive for txHash", () => {
    dedup.isDuplicate(11155111, "0xABCDEF");
    const isDup = dedup.isDuplicate(11155111, "0xabcdef");
    expect(isDup).toBe(true);
  });

  it("should distinguish same txHash across different chainIds", () => {
    dedup.isDuplicate(11155111, "0x123");
    const isDup = dedup.isDuplicate(17000, "0x123");
    expect(isDup).toBe(false);
  });
});
