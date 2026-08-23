import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { getDatabase } from "./storage/database.js";
import { EventRepository } from "./storage/event-repository.js";
import { ReconRepository } from "./storage/recon-repository.js";
import { EventNormalizer } from "./normalizer/normalizer.js";
import { globalDeduplicator } from "./normalizer/dedup.js";
import { IntentExtractor } from "./ai/intent-extractor.js";
import { ReconciliationEngine } from "./reconciliation/engine.js";
import { ContractWriter } from "./blockchain/contract-writer.js";
import { SepoliaListener } from "./listeners/sepolia-listener.js";
import { SimulatorListener } from "./listeners/simulator-listener.js";
import { createServer } from "./api/server.js";
import { RawBlockchainEvent } from "./listeners/types.js";

async function bootstrap() {
  logger.info("=========================================");
  logger.info("🚀 Starting ChainMind Audit System");
  logger.info("=========================================");

  // 1. Initialize Storage
  const db = getDatabase();
  const eventRepo = new EventRepository();
  const reconRepo = new ReconRepository();

  // 2. Initialize AI & Blockchain
  const intentExtractor = new IntentExtractor();
  const contractWriter = new ContractWriter(reconRepo);

  // 3. Initialize Reconciliation Engine
  const reconEngine = new ReconciliationEngine(eventRepo, reconRepo);
  
  // Wire auto-anchoring on new reconciliation
  reconEngine.onReconciled(async () => {
    await contractWriter.anchorBatch();
  });
  
  reconEngine.start();

  // 4. Ingestion Pipeline handler
  async function handleIngestedEvent(raw: RawBlockchainEvent) {
    // Dedup check (Layer 1)
    if (globalDeduplicator.isDuplicate(raw.chainId, raw.txHash)) {
      return;
    }

    // Normalization
    const normalized = EventNormalizer.normalize(raw);

    // Dedup insert (Layer 2)
    const inserted = eventRepo.insertEvent(normalized);
    if (!inserted) {
      logger.warn({ chainId: raw.chainId, txHash: raw.txHash }, "Event already recorded in database");
      return;
    }

    logger.info(
      { chainId: normalized.chain_id, txHash: normalized.tx_hash, valueWei: normalized.value_wei },
      "Normalized and stored new event"
    );

    // AI Semantic Intent Extraction
    const intentResult = await intentExtractor.extractIntent(normalized);
    eventRepo.updateEventIntent(
      normalized.id,
      intentResult.intent,
      intentResult.source,
      intentResult.confidenceScore
    );
  }

  // 5. Initialize Listeners
  const sepoliaListener = new SepoliaListener();
  const simulatorListener = new SimulatorListener();

  sepoliaListener.onEvent(handleIngestedEvent);
  simulatorListener.onEvent(handleIngestedEvent);

  await sepoliaListener.start();
  await simulatorListener.start();

  // 6. Start REST API Server
  const app = createServer(eventRepo, reconRepo);

  // Add developer simulation trigger endpoint
  app.post("/api/v1/simulate/cross-chain-swap", async (req, res) => {
    try {
      const sender = req.body.sender || "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18";
      const receiver = req.body.receiver || sender;
      const valueEth = req.body.value_eth || "0.5";
      const valueWei = (BigInt(Math.round(parseFloat(valueEth) * 1e6)) * 10n ** 12n).toString();
      const delaySeconds = req.body.delay_seconds || 3;
      const slippageRatio = req.body.slippage_ratio !== undefined ? parseFloat(req.body.slippage_ratio) : 1.0;

      const sourceTxHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      const now = Math.floor(Date.now() / 1000);

      // 1. Emit source chain bridge event (Sepolia)
      const sourceEvent: RawBlockchainEvent = {
        chainId: 11155111,
        txHash: sourceTxHash,
        blockNumber: 6543200,
        blockTimestamp: now,
        sender,
        receiver: config.bridgeSenderAddress || "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
        valueWei,
        inputData: "0x8b95dd71" + "0".repeat(56), // initiateBridge selector
        eventName: "BridgeInitiated",
        confirmations: 15,
      };

      await sepoliaListener.ingestManualEvent(sourceEvent);

      // 2. Schedule destination chain bridge completion event (Chain B)
      simulatorListener.simulateCounterpartEvent(
        sourceTxHash,
        sender,
        receiver,
        valueWei,
        now,
        delaySeconds,
        slippageRatio
      );

      res.json({
        success: true,
        message: "Cross-chain swap simulation initiated",
        source_tx_hash: sourceTxHash,
        counterpart_eta_seconds: delaySeconds,
        sender,
        value_eth: valueEth,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  const server = app.listen(config.apiPort, () => {
    logger.info(`✨ REST API Server listening on http://localhost:${config.apiPort}`);
    logger.info(`📊 Health check: http://localhost:${config.apiPort}/health`);
    logger.info(`📋 Audit Summary: http://localhost:${config.apiPort}/api/v1/reconciliation/summary`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Gracefully shutting down ChainMind Audit...");
    server.close();
    reconEngine.stop();
    await sepoliaListener.stop();
    await simulatorListener.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  logger.error({ err }, "Fatal error during ChainMind Audit startup");
  process.exit(1);
});
