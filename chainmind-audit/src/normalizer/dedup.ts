import { logger } from "../utils/logger.js";

/**
 * Layer 1 In-Memory Deduplicator with automatic TTL eviction.
 * Maintains an in-memory Set of seen `${chainId}:${txHash}` keys.
 */
export class EventDeduplicator {
  private seenSet: Map<string, number> = new Map();
  private readonly evictionWindowMs: number;

  constructor(evictionWindowMinutes = 30) {
    this.evictionWindowMs = evictionWindowMinutes * 60 * 1000;
    
    // Periodically evict expired entries to prevent memory growth
    setInterval(() => this.evictStale(), 5 * 60 * 1000);
  }

  isDuplicate(chainId: number, txHash: string): boolean {
    const key = `${chainId}:${txHash.toLowerCase()}`;
    if (this.seenSet.has(key)) {
      logger.warn({ chainId, txHash }, "Duplicate event detected in Layer 1 In-Memory Seen-Set");
      return true;
    }
    this.seenSet.set(key, Date.now());
    return false;
  }

  evictStale(): void {
    const cutoff = Date.now() - this.evictionWindowMs;
    let evicted = 0;
    for (const [key, ts] of this.seenSet.entries()) {
      if (ts < cutoff) {
        this.seenSet.delete(key);
        evicted++;
      }
    }
    if (evicted > 0) {
      logger.debug({ evictedCount: evicted }, "Evicted stale keys from dedup seenSet");
    }
  }

  clear(): void {
    this.seenSet.clear();
  }

  size(): number {
    return this.seenSet.size;
  }
}

export const globalDeduplicator = new EventDeduplicator();
