import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import { IntentResult, OllamaChatResponse } from "./types.js";
import { NormalizedEvent, SemanticIntent } from "../storage/types.js";

export class OllamaClient {
  private baseUrl: string;
  private model: string;
  private timeoutMs: number;

  constructor() {
    this.baseUrl = config.ollamaBaseUrl;
    this.model = config.ollamaModel;
    this.timeoutMs = config.ollamaTimeoutMs;
  }

  async classifyEvent(event: NormalizedEvent): Promise<IntentResult | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const userPrompt = buildUserPrompt(event);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          format: {
            type: "object",
            properties: {
              intent: {
                type: "string",
                enum: [
                  "BRIDGE_INITIATE",
                  "BRIDGE_COMPLETE",
                  "SWAP",
                  "DEPOSIT",
                  "WITHDRAW",
                  "TRANSFER",
                  "UNKNOWN",
                ],
              },
              confidence_score: { type: "number" },
              reasoning: { type: "string" },
            },
            required: ["intent", "confidence_score", "reasoning"],
          },
          stream: false,
          options: {
            temperature: 0.0,
            num_predict: 120,
          },
        }),
      });

      if (!response.ok) {
        logger.debug({ status: response.status }, "Ollama HTTP response not OK");
        return null;
      }

      const data = (await response.json()) as OllamaChatResponse;
      const content = data.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      const validIntents: SemanticIntent[] = [
        "BRIDGE_INITIATE",
        "BRIDGE_COMPLETE",
        "SWAP",
        "DEPOSIT",
        "WITHDRAW",
        "TRANSFER",
        "UNKNOWN",
      ];

      const intent = validIntents.includes(parsed.intent) ? (parsed.intent as SemanticIntent) : "UNKNOWN";
      let confidence = typeof parsed.confidence_score === "number" ? parsed.confidence_score : 0.5;
      
      // Confidence floor guardrail
      if (confidence < config.intentConfidenceFloor) {
        return {
          intent: "UNKNOWN",
          confidenceScore: confidence,
          source: "LLM",
          reasoning: parsed.reasoning || "Low confidence classification",
        };
      }

      return {
        intent,
        confidenceScore: confidence,
        source: "LLM",
        reasoning: parsed.reasoning || "Extracted via local LLM",
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        logger.debug("Ollama inference timed out; engaging fallback classifier");
      } else {
        logger.debug({ err: err.message }, "Ollama inference unavailable; engaging fallback classifier");
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
