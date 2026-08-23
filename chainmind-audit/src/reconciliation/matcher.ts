import { NormalizedEvent } from "../storage/types.js";
import { MatchCandidate } from "./types.js";
import { normalizeAddress } from "../utils/address.js";
import { logger } from "../utils/logger.js";

export class ReconciliationMatcher {
  private static readonly MAX_SCORE = 4.0;
  private static readonly MATCH_THRESHOLD = 0.625; // 2.5 / 4.0

  /**
   * Evaluates compatibility and computes a weighted composite similarity score
   * between two normalized cross-chain events.
   */
  static evaluateMatch(a: NormalizedEvent, b: NormalizedEvent): MatchCandidate | null {
    // Both must be on different chains
    if (a.chain_id === b.chain_id) {
      return null;
    }

    let score = 0;

    // ── Factor 1: Sender Match (Weight: 1.5) ──
    const senderA = normalizeAddress(a.sender);
    const senderB = normalizeAddress(b.sender);
    if (senderA && senderB && senderA === senderB) {
      score += 1.5;
    } else {
      // Direct sender correlation is required for cross-chain user intent in our model
      return null;
    }

    // ── Factor 2: Receiver Match (Weight: 1.0) ──
    const receiverA = normalizeAddress(a.receiver);
    const receiverB = normalizeAddress(b.receiver);
    if (receiverA === receiverB) {
      score += 1.0;
    } else if (receiverB === senderA) {
      score += 0.75; // Bridge self-receive pattern
    }

    // ── Factor 3: Value Match (Weight: 1.0) ──
    const valueA = BigInt(a.value_wei || "0");
    const valueB = BigInt(b.value_wei || "0");
    const delta = valueA > valueB ? valueA - valueB : valueB - valueA;
    const maxVal = valueA > valueB ? valueA : valueB;

    let valueScore = 0;
    if (delta === 0n) {
      valueScore = 1.0; // Exact match
    } else if (maxVal > 0n && (delta * 10000n) / maxVal <= 100n) {
      valueScore = 0.5; // Within 1% (slippage / bridge fee allowance)
    }
    score += valueScore;

    // ── Factor 4: Timestamp Proximity (Weight: 0.5) ──
    const timeDelta = Math.abs(a.block_timestamp - b.block_timestamp);
    if (timeDelta <= 120) {
      score += 0.5; // Within 2 minutes
    } else if (timeDelta <= 900) {
      score += 0.25; // Within 15 minutes
    }

    const normalizedScore = score / this.MAX_SCORE;

    if (normalizedScore >= this.MATCH_THRESHOLD) {
      return {
        eventA: a,
        eventB: b,
        score: normalizedScore,
        matchType: delta === 0n ? "EXACT" : "FUZZY_VALUE",
        valueDeltaWei: delta.toString(),
        timestampDeltaSeconds: timeDelta,
      };
    }

    return null;
  }

  /**
   * Verifies if semantic intents across the two legs are compatible.
   */
  static validateIntentConsistency(intentA: string, intentB: string): {
    isConsistent: boolean;
    reason?: string;
  } {
    if (intentA === "BRIDGE_INITIATE" && intentB === "BRIDGE_COMPLETE") {
      return { isConsistent: true };
    }
    if (intentA === "SWAP" && intentB === "SWAP") {
      return { isConsistent: true };
    }
    if (intentA === "DEPOSIT" && intentB === "WITHDRAW") {
      return { isConsistent: true };
    }
    if (intentA === "UNKNOWN" || intentB === "UNKNOWN") {
      return { isConsistent: true, reason: "One or both intents unclassified; matched on financial metadata" };
    }

    if (intentA === "BRIDGE_INITIATE" && intentB === "SWAP") {
      return { isConsistent: false, reason: "Bridge initiation paired with incompatible swap event" };
    }

    return { isConsistent: true };
  }
}
