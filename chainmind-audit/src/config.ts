import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const config = {
  // Blockchain
  sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL || "wss://ethereum-sepolia-rpc.publicnode.com",
  sepoliaHttpUrl: process.env.SEPOLIA_HTTP_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  auditorPrivateKey: process.env.AUDITOR_PRIVATE_KEY || "",
  chainMindContractAddress: process.env.CHAINMIND_CONTRACT_ADDRESS || "",
  bridgeSenderAddress: process.env.BRIDGE_SENDER_ADDRESS || "",
  bridgeReceiverAddress: process.env.BRIDGE_RECEIVER_ADDRESS || "",

  // AI & Intent Extraction
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.1:8b",
  ollamaTimeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || "2000", 10),
  intentConfidenceFloor: parseFloat(process.env.INTENT_CONFIDENCE_FLOOR || "0.5"),

  // Reconciliation Parameters
  toleranceWindowSeconds: parseInt(process.env.TOLERANCE_WINDOW_S || "900", 10), // 15 mins default
  reconPollIntervalMs: parseInt(process.env.RECON_POLL_INTERVAL_MS || "1000", 10),
  batchSize: parseInt(process.env.BATCH_SIZE || "5", 10),

  // REST API
  apiPort: parseInt(process.env.API_PORT || "3000", 10),
  apiRateLimitPerMin: parseInt(process.env.API_RATE_LIMIT_PER_MIN || "100", 10),

  // Storage
  sqlitePath: process.env.SQLITE_PATH || path.resolve(__dirname, "../data/chainmind.db"),
};
