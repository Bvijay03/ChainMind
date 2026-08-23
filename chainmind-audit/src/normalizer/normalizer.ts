import { generateUUID } from "../utils/uuid.js";
import { normalizeAddress } from "../utils/address.js";
import { NormalizedEvent } from "../storage/types.js";
import { RawBlockchainEvent } from "../listeners/types.js";

export class EventNormalizer {
  /**
   * Transforms raw blockchain event or transaction payload into canonical NormalizedEvent schema.
   */
  static normalize(raw: RawBlockchainEvent): NormalizedEvent {
    const functionSelector = raw.inputData && raw.inputData.length >= 10
      ? raw.inputData.slice(0, 10).toLowerCase()
      : null;

    return {
      id: generateUUID(),
      chain_id: raw.chainId,
      tx_hash: raw.txHash.toLowerCase(),
      block_number: raw.blockNumber,
      block_timestamp: raw.blockTimestamp,
      sender: normalizeAddress(raw.sender),
      receiver: normalizeAddress(raw.receiver),
      value_wei: raw.valueWei ? raw.valueWei.toString() : "0",
      input_data: raw.inputData ? raw.inputData.slice(0, 1024) : null,
      function_selector: functionSelector,

      extracted_intent: "UNKNOWN",
      intent_source: "PENDING",
      confidence_score: 0.0,

      block_confirmations: raw.confirmations || 1,
      ingested_at: Date.now(),
      processed_at: null,
      recon_status: "PENDING",
      recon_record_id: null,
    };
  }
}
