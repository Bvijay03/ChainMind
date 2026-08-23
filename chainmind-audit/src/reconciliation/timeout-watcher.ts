import { EventRepository } from "../storage/event-repository.js";
import { ReconRepository } from "../storage/recon-repository.js";
import { ReconciliationRecord } from "../storage/types.js";
import { generateUUID } from "../utils/uuid.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";

export class TimeoutWatcher {
  private eventRepo: EventRepository;
  private reconRepo: ReconRepository;

  constructor(eventRepo: EventRepository, reconRepo: ReconRepository) {
    this.eventRepo = eventRepo;
    this.reconRepo = reconRepo;
  }

  /**
   * Scans for events that have exceeded the tolerance window without a counterpart match.
   */
  checkTimeouts(): void {
    const cutoff = Math.floor(Date.now() / 1000) - config.toleranceWindowSeconds;
    const expiredEvents = this.eventRepo.findExpiredPendingEvents(cutoff);

    for (const event of expiredEvents) {
      logger.warn(
        { txHash: event.tx_hash, chainId: event.chain_id, blockTimestamp: event.block_timestamp },
        "Event timed out without counterpart confirmation — flagging as FLAGGED_TIMEOUT"
      );

      const reconRecord: ReconciliationRecord = {
        id: generateUUID(),
        event_a_id: event.id,
        event_b_id: null,
        chain_a_id: event.chain_id,
        chain_b_id: null,
        tx_hash_a: event.tx_hash,
        tx_hash_b: null,
        match_type: "TIMEOUT",
        status: "FLAGGED_TIMEOUT",
        match_score: 0.0,
        sender: event.sender,
        receiver: event.receiver,
        value_a_wei: event.value_wei,
        value_b_wei: null,
        value_delta_wei: "0",
        timestamp_a: event.block_timestamp,
        timestamp_b: null,
        timestamp_delta_s: null,
        intent_a: event.extracted_intent,
        intent_b: null,
        anchor_tx_hash: null,
        anchor_block: null,
        anchored_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        notes: "Confirmation timeout: No counterpart transaction detected within tolerance window.",
      };

      this.reconRepo.insertReconciliation(reconRecord);
      this.eventRepo.updateEventStatus(event.id, "FLAGGED_TIMEOUT", reconRecord.id);
    }
  }
}
