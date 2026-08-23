import { Router, Request, Response } from "express";
import { EventRepository } from "../../storage/event-repository.js";
import { ReconRepository } from "../../storage/recon-repository.js";
import { validateTxHashQuery } from "../middleware/validator.js";

export function createReconciliationRouter(
  eventRepo: EventRepository,
  reconRepo: ReconRepository
): Router {
  const router = Router();

  /**
   * GET /api/v1/reconciliation/status?tx_hash=0x...&chain_id=...
   */
  router.get("/status", validateTxHashQuery, (req: Request, res: Response) => {
    const txHash = req.query.tx_hash as string;
    const chainId = req.query.chain_id ? parseInt(req.query.chain_id as string, 10) : undefined;

    const event = eventRepo.getEventByTxHash(txHash, chainId);
    if (!event) {
      res.status(404).json({
        success: false,
        error: {
          code: "TX_NOT_FOUND",
          message: `Transaction ${txHash} not found in event log.`,
        },
      });
      return;
    }

    const recon = reconRepo.getReconciliationByTxHash(txHash);

    res.json({
      success: true,
      data: {
        event: {
          id: event.id,
          chain_id: event.chain_id,
          tx_hash: event.tx_hash,
          sender: event.sender,
          receiver: event.receiver,
          value_wei: event.value_wei,
          block_timestamp: event.block_timestamp,
          extracted_intent: event.extracted_intent,
          intent_source: event.intent_source,
          confidence_score: event.confidence_score,
          block_confirmations: event.block_confirmations,
          recon_status: event.recon_status,
        },
        reconciliation: recon
          ? {
              id: recon.id,
              status: recon.status,
              match_type: recon.match_type,
              match_score: recon.match_score,
              counterpart: {
                chain_id: recon.tx_hash_a.toLowerCase() === txHash.toLowerCase() ? recon.chain_b_id : recon.chain_a_id,
                tx_hash: recon.tx_hash_a.toLowerCase() === txHash.toLowerCase() ? recon.tx_hash_b : recon.tx_hash_a,
                block_timestamp: recon.tx_hash_a.toLowerCase() === txHash.toLowerCase() ? recon.timestamp_b : recon.timestamp_a,
                extracted_intent: recon.tx_hash_a.toLowerCase() === txHash.toLowerCase() ? recon.intent_b : recon.intent_a,
              },
              timestamp_delta_s: recon.timestamp_delta_s,
              value_delta_wei: recon.value_delta_wei,
              anchor_tx_hash: recon.anchor_tx_hash,
              notes: recon.notes,
              created_at: new Date(recon.created_at).toISOString(),
            }
          : null,
      },
    });
  });

  /**
   * GET /api/v1/reconciliation/summary?since=...&limit=...
   */
  router.get("/summary", (req: Request, res: Response) => {
    const since = req.query.since ? parseInt(req.query.since as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const summary = reconRepo.getSummary(since, Math.min(limit, 100));

    res.json({
      success: true,
      data: {
        summary: {
          total_events_ingested: summary.totalEvents,
          total_reconciliations: summary.totalReconciliations,
          status_breakdown: summary.statusBreakdown,
          pending_events: summary.pendingEvents,
          avg_reconciliation_time_ms: summary.avgLatencyMs,
          avg_timestamp_delta_s: summary.avgTimeDeltaSeconds,
          on_chain_anchored: summary.onChainAnchored,
          on_chain_pending: summary.onChainPending,
        },
        recent_records: summary.recentRecords.map((r) => ({
          id: r.id,
          status: r.status,
          sender: r.sender,
          receiver: r.receiver,
          tx_hash_a: r.tx_hash_a,
          tx_hash_b: r.tx_hash_b,
          value_a_wei: r.value_a_wei,
          timestamp_delta_s: r.timestamp_delta_s,
          match_score: r.match_score,
          anchor_tx_hash: r.anchor_tx_hash,
          created_at: new Date(r.created_at).toISOString(),
        })),
      },
    });
  });

  /**
   * GET /api/v1/reconciliation/flagged?status=...&page=...&page_size=...
   */
  router.get("/flagged", (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.page_size ? parseInt(req.query.page_size as string, 10) : 20;

    const { records, total } = reconRepo.getFlaggedRecords(status, page, Math.min(pageSize, 50));

    res.json({
      success: true,
      data: {
        flagged_records: records.map((r) => ({
          id: r.id,
          status: r.status,
          match_type: r.match_type,
          sender: r.sender,
          tx_hash_a: r.tx_hash_a,
          tx_hash_b: r.tx_hash_b,
          timestamp_delta_s: r.timestamp_delta_s,
          value_delta_wei: r.value_delta_wei,
          notes: r.notes,
          created_at: new Date(r.created_at).toISOString(),
        })),
        pagination: {
          page,
          page_size: pageSize,
          total_records: total,
          total_pages: Math.ceil(total / pageSize) || 1,
        },
      },
    });
  });

  return router;
}
