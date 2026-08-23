import { NormalizedEvent, ReconciliationRecord, MatchType } from "../storage/types.js";

export interface MatchCandidate {
  eventA: NormalizedEvent;
  eventB: NormalizedEvent;
  score: number;
  matchType: MatchType;
  valueDeltaWei: string;
  timestampDeltaSeconds: number;
}
