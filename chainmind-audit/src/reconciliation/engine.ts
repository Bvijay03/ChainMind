import { EventRepository } from "../storage/event-repository.js";
import { ReconRepository } from "../storage/recon-repository.js";
import { ReconciliationMatcher } from "./matcher.js";
import { TimeoutWatcher } from "./timeout-watcher.js";
import { ReconciliationRecord, ReconciliationStatus } from "../storage/types.js";
import { generateUUID } from "../utils/uuid.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";

export class ReconciliationEngine {
  private eventRepo: EventRepository;
  private reconRepo: ReconRepository;
  private timeoutWatcher: TimeoutWatcher;
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private onReconciledCallbacks: ((record: ReconciliationRecord) => void)[] = [];

  constructor(eventRepo: EventRepository, reconRepo: ReconRepository) {
    this.eventRepo = eventRepo;
    this.reconRepo = reconRepo;
    this.timeoutWatcher = new TimeoutWatcher(eventRepo, reconRepo);
  }

  onReconciled(callback: (record: ReconciliationRecord) => void): void {
    this.onReconciledCallbacks.push(callback);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info("Reconciliation Engine started");

    this.pollTimer = setInterval(() => this.tick(), config.reconPollIntervalMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info("Reconciliation Engine stopped");
  }

  async tick(): Promise<void> {
    try {
      // 1. Process pending reconciliations
      await this.processPendingEvents();

      // 2. Check for timed out transactions
      this.timeoutWatcher.checkTimeouts();
    } catch (err) {
      logger.error({ err }, "Error during reconciliation tick");
    }
  }

  private async processPendingEvents(): Promise<void> {
    const pending = this.eventRepo.getPendingEvents(25);
    if (pending.length === 0) return;

    for (const event of pending) {
      // Find candidate counterparts on other chains within tolerance window
      const candidates = this.eventRepo.findCandidatesForEvent(
        event,
        config.toleranceWindowSeconds
      );

      let bestMatch: ReturnType<typeof ReconciliationMatcher.evaluateMatch> = null;

      for (const candidate of candidates) {
        if (candidate.id === event.id) continue;
        const matchResult = ReconciliationMatcher.evaluateMatch(event, candidate);
        if (matchResult) {
          if (!bestMatch || matchResult.score > bestMatch.score) {
            bestMatch = matchResult;
          }
        }
      }

      if (bestMatch) {
        // Evaluate intent compatibility
        const intentCheck = ReconciliationMatcher.validateIntentConsistency(
          bestMatch.eventA.extracted_intent,
          bestMatch.eventB.extracted_intent
        );

        let finalStatus: ReconciliationStatus = "MATCHED";
        let notes = `Matched cross-chain pair (${bestMatch.matchType}) with confidence ${bestMatch.score.toFixed(3)}`;

        if (!intentCheck.isConsistent) {
          finalStatus = "FLAGGED_INTENT_CONFLICT";
          notes = `Intent conflict: ${intentCheck.reason}`;
        } else if (bestMatch.matchType === "FUZZY_VALUE") {
          notes += ` (Value delta: ${bestMatch.valueDeltaWei} wei)`;
        }

        // Check if out of order
        if (bestMatch.eventB.block_timestamp < bestMatch.eventA.block_timestamp) {
          notes += " [Out-of-order: destination timestamp preceded source]";
        }

        const reconRecord: ReconciliationRecord = {
          id: generateUUID(),
          event_a_id: bestMatch.eventA.id,
          event_b_id: bestMatch.eventB.id,
          chain_a_id: bestMatch.eventA.chain_id,
          chain_b_id: bestMatch.eventB.chain_id,
          tx_hash_a: bestMatch.eventA.tx_hash,
          tx_hash_b: bestMatch.eventB.tx_hash,
          match_type: bestMatch.matchType,
          status: finalStatus,
          match_score: bestMatch.score,
          sender: bestMatch.eventA.sender,
          receiver: bestMatch.eventA.receiver,
          value_a_wei: bestMatch.eventA.value_wei,
          value_b_wei: bestMatch.eventB.value_wei,
          value_delta_wei: bestMatch.valueDeltaWei,
          timestamp_a: bestMatch.eventA.block_timestamp,
          timestamp_b: bestMatch.eventB.block_timestamp,
          timestamp_delta_s: bestMatch.timestampDeltaSeconds,
          intent_a: bestMatch.eventA.extracted_intent,
          intent_b: bestMatch.eventB.extracted_intent,
          anchor_tx_hash: null,
          anchor_block: null,
          anchored_at: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          notes,
        };

        this.reconRepo.insertReconciliation(reconRecord);
        this.eventRepo.updateEventStatus(bestMatch.eventA.id, finalStatus, reconRecord.id);
        this.eventRepo.updateEventStatus(bestMatch.eventB.id, finalStatus, reconRecord.id);

        logger.info(
          {
            reconId: reconRecord.id,
            status: finalStatus,
            txA: reconRecord.tx_hash_a,
            txB: reconRecord.tx_hash_b,
            score: reconRecord.match_score,
          },
          "Reconciled transaction pair"
        );

        for (const cb of this.onReconciledCallbacks) {
          try {
            cb(reconRecord);
          } catch (e) {
            logger.error({ err: e }, "Callback error on reconciled record");
          }
        }
      }
    }
  }
}
