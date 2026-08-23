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
import { ethers } from "ethers";

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

  // Developer / Judge Simulation Trigger Endpoint with 4 Test Scenarios
  app.post("/api/v1/simulate/cross-chain-swap", async (req, res) => {
    try {
      const sender = req.body.sender || "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18";
      const receiver = req.body.receiver || sender;
      const valueEth = req.body.value_eth || "1.0";
      const valueWei = (BigInt(Math.round(parseFloat(valueEth) * 1e6)) * 10n ** 12n).toString();
      const delaySeconds = req.body.delay_seconds || 2;
      const mode = req.body.mode || (req.body.slippage_ratio !== undefined && parseFloat(req.body.slippage_ratio) < 1.0 ? "FUZZY" : "EXACT");

      const sourceTxHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      const now = Math.floor(Date.now() / 1000);

      // In TIMEOUT mode, backdate blockTimestamp by 1000s (>900s tolerance window) so TimeoutWatcher triggers immediately
      const blockTimestamp = mode === "TIMEOUT" ? (now - 1000) : now;

      // 1. Emit Source Chain Event (Sepolia BridgeInitiated)
      const sourceEvent: RawBlockchainEvent = {
        chainId: 11155111,
        txHash: sourceTxHash,
        blockNumber: 6543200 + Math.floor(Math.random() * 100),
        blockTimestamp,
        sender,
        receiver: config.bridgeSenderAddress || "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
        valueWei,
        inputData: "0x8b95dd71" + "0".repeat(56), // initiateBridge
        eventName: "BridgeInitiated",
        confirmations: 15,
      };

      await sepoliaListener.ingestManualEvent(sourceEvent);

      // 2. Handle Scenario Modes
      if (mode === "TIMEOUT") {
        // Scenario 4: Leg 2 never arrives ➔ TimeoutWatcher immediately catches it on next tick
        res.json({
          success: true,
          scenario: "TIMEOUT",
          message: "Orphan transaction initiated. No counterpart sent on Chain B (simulating dropped relayer). Flagged as FLAGGED_TIMEOUT.",
          source_tx_hash: sourceTxHash,
          sender,
          value_eth: valueEth,
        });
        return;
      }

      if (mode === "INTENT_CONFLICT") {
        // Scenario 3: Leg 2 arrives with incompatible intent (SWAP selector 0x38ed1739 instead of BRIDGE_COMPLETE)
        setTimeout(async () => {
          const fakeTxHashB = ethers.keccak256(ethers.toUtf8Bytes(`chainB-conflict-${sourceTxHash}-${Date.now()}`));
          const conflictEvent: RawBlockchainEvent = {
            chainId: 17000,
            txHash: fakeTxHashB,
            blockNumber: 5432200,
            blockTimestamp: now + delaySeconds,
            sender,
            receiver,
            valueWei,
            inputData: "0x38ed1739" + "0".repeat(56), // Uniswap swap selector (conflict!)
            eventName: "TokenSwapped",
            confirmations: 12,
          };
          await simulatorListener.ingestManualEvent(conflictEvent);
        }, delaySeconds * 1000);

        res.json({
          success: true,
          scenario: "INTENT_CONFLICT",
          message: "Conflicting trade initiated. Chain B counterpart emits a SWAP instead of BRIDGE_COMPLETE. Flagged as FLAGGED_INTENT_CONFLICT.",
          source_tx_hash: sourceTxHash,
          counterpart_eta_seconds: delaySeconds,
          sender,
          value_eth: valueEth,
        });
        return;
      }

      // Scenario 1 (EXACT) or Scenario 2 (FUZZY)
      const slippageRatio = mode === "FUZZY" ? (req.body.slippage_ratio ? parseFloat(req.body.slippage_ratio) : 0.995) : 1.0;
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
        scenario: mode,
        message: mode === "EXACT" ? "Exact cross-chain swap initiated" : "Fuzzy cross-chain swap with fee slippage initiated",
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
