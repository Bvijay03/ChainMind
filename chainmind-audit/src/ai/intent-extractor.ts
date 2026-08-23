import { OllamaClient } from "./ollama-client.js";
import { FallbackClassifier } from "./fallback-classifier.js";
import { IntentResult } from "./types.js";
import { NormalizedEvent } from "../storage/types.js";
import { logger } from "../utils/logger.js";

export class IntentExtractor {
  private ollama = new OllamaClient();

  async extractIntent(event: NormalizedEvent): Promise<IntentResult> {
    const startTime = Date.now();

    // 1. Attempt LLM classification
    const llmResult = await this.ollama.classifyEvent(event);
    if (llmResult && llmResult.intent !== "UNKNOWN") {
      const elapsed = Date.now() - startTime;
      logger.info(
        { txHash: event.tx_hash, intent: llmResult.intent, confidence: llmResult.confidenceScore, elapsedMs: elapsed },
        "Intent classified via local LLM"
      );
      return llmResult;
    }

    // 2. Fallback to deterministic classifier
    const fallbackResult = FallbackClassifier.classify(
      event.function_selector,
      event.value_wei,
      event.input_data
    );

    const elapsed = Date.now() - startTime;
    logger.info(
      { txHash: event.tx_hash, intent: fallbackResult.intent, source: fallbackResult.source, elapsedMs: elapsed },
      "Intent classified via Rule-Based Fallback"
    );

    return fallbackResult;
  }
}
