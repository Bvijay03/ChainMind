import { getDatabase } from "./database.js";
import { NormalizedEvent, ReconciliationStatus, SemanticIntent, IntentSource } from "./types.js";

export class EventRepository {
  private db = getDatabase();

  insertEvent(event: NormalizedEvent): boolean {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO event_log (
        id, chain_id, tx_hash, block_number, block_timestamp,
        sender, receiver, value_wei, input_data, function_selector,
        extracted_intent, intent_source, confidence_score,
        block_confirmations, ingested_at, processed_at,
        recon_status, recon_record_id
      ) VALUES (
        @id, @chain_id, @tx_hash, @block_number, @block_timestamp,
        @sender, @receiver, @value_wei, @input_data, @function_selector,
        @extracted_intent, @intent_source, @confidence_score,
        @block_confirmations, @ingested_at, @processed_at,
        @recon_status, @recon_record_id
      )
    `);

    const result = stmt.run(event);
    return result.changes > 0;
  }

  getEventById(id: string): NormalizedEvent | null {
    const stmt = this.db.prepare(`SELECT * FROM event_log WHERE id = ?`);
    return (stmt.get(id) as NormalizedEvent) || null;
  }

  getEventByTxHash(txHash: string, chainId?: number): NormalizedEvent | null {
    if (chainId) {
      const stmt = this.db.prepare(`SELECT * FROM event_log WHERE tx_hash = ? AND chain_id = ?`);
      return (stmt.get(txHash.toLowerCase(), chainId) as NormalizedEvent) || null;
    }
    const stmt = this.db.prepare(`SELECT * FROM event_log WHERE LOWER(tx_hash) = LOWER(?) LIMIT 1`);
    return (stmt.get(txHash) as NormalizedEvent) || null;
  }

  getPendingEvents(limit = 50): NormalizedEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM event_log 
      WHERE recon_status = 'PENDING' 
      ORDER BY block_timestamp ASC 
      LIMIT ?
    `);
    return stmt.all(limit) as NormalizedEvent[];
  }

  findCandidatesForEvent(
    targetEvent: NormalizedEvent,
    toleranceWindowSeconds: number
  ): NormalizedEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM event_log 
      WHERE chain_id != ? 
        AND recon_status = 'PENDING'
        AND ABS(block_timestamp - ?) <= ?
        AND LOWER(sender) = LOWER(?)
    `);
    return stmt.all(
      targetEvent.chain_id,
      targetEvent.block_timestamp,
      toleranceWindowSeconds,
      targetEvent.sender
    ) as NormalizedEvent[];
  }

  findExpiredPendingEvents(cutoffTimestamp: number): NormalizedEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM event_log
      WHERE recon_status = 'PENDING'
        AND block_timestamp <= ?
    `);
    return stmt.all(cutoffTimestamp) as NormalizedEvent[];
  }

  updateEventIntent(
    id: string,
    intent: SemanticIntent,
    source: IntentSource,
    confidence: number
  ): void {
    const stmt = this.db.prepare(`
      UPDATE event_log 
      SET extracted_intent = ?, intent_source = ?, confidence_score = ?, processed_at = ?
      WHERE id = ?
    `);
    stmt.run(intent, source, confidence, Date.now(), id);
  }

  updateEventStatus(
    id: string,
    status: ReconciliationStatus,
    reconRecordId?: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE event_log 
      SET recon_status = ?, recon_record_id = ?
      WHERE id = ?
    `);
    stmt.run(status, reconRecordId || null, id);
  }

  countTotalEvents(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM event_log`).get() as { count: number };
    return row.count;
  }

  countPendingEvents(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM event_log WHERE recon_status = 'PENDING'`).get() as { count: number };
    return row.count;
  }
}
