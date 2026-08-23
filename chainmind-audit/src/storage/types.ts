export type SemanticIntent =
  | 'BRIDGE_INITIATE'
  | 'BRIDGE_COMPLETE'
  | 'SWAP'
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'TRANSFER'
  | 'UNKNOWN';

export type IntentSource = 'LLM' | 'RULE_BASED' | 'MANUAL' | 'PENDING';

export type ReconciliationStatus =
  | 'PENDING'
  | 'MATCHED'
  | 'FLAGGED_TIMEOUT'
  | 'FLAGGED_DUPLICATE'
  | 'FLAGGED_VALUE_MISMATCH'
  | 'FLAGGED_INTENT_CONFLICT';

export type MatchType = 'EXACT' | 'FUZZY_VALUE' | 'FUZZY_TIME' | 'TIMEOUT';

export interface NormalizedEvent {
  id: string;
  chain_id: number;
  tx_hash: string;
  block_number: number;
  block_timestamp: number;
  sender: string;
  receiver: string;
  value_wei: string;
  input_data: string | null;
  function_selector: string | null;
  
  extracted_intent: SemanticIntent;
  intent_source: IntentSource;
  confidence_score: number;
  
  block_confirmations: number;
  ingested_at: number;
  processed_at: number | null;
  recon_status: ReconciliationStatus;
  recon_record_id: string | null;
}

export interface ReconciliationRecord {
  id: string;
  event_a_id: string;
  event_b_id: string | null;
  chain_a_id: number;
  chain_b_id: number | null;
  tx_hash_a: string;
  tx_hash_b: string | null;
  
  match_type: MatchType;
  status: ReconciliationStatus;
  match_score: number | null;
  
  sender: string;
  receiver: string;
  value_a_wei: string;
  value_b_wei: string | null;
  value_delta_wei: string;
  timestamp_a: number;
  timestamp_b: number | null;
  timestamp_delta_s: number | null;
  intent_a: string | null;
  intent_b: string | null;
  
  anchor_tx_hash: string | null;
  anchor_block: number | null;
  anchored_at: number | null;
  
  created_at: number;
  updated_at: number;
  notes: string | null;
}
