import { SemanticIntent, IntentSource } from "../storage/types.js";

export interface IntentResult {
  intent: SemanticIntent;
  confidenceScore: number;
  source: IntentSource;
  reasoning: string;
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}
