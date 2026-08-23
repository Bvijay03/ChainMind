import { ethers } from "ethers";
import { BaseEventListener } from "./base-listener.js";
import { RawBlockchainEvent } from "./types.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export class SepoliaListener extends BaseEventListener {
  public readonly chainId = 11155111;
  public readonly name = "Sepolia Testnet";
  private provider: ethers.JsonRpcProvider | ethers.WebSocketProvider | null = null;
  private bridgeSenderContract: ethers.Contract | null = null;
  private isPolling = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastQueriedBlock = 0;

  // ABI for MockBridgeSender
  private readonly BRIDGE_SENDER_ABI = [
    "event BridgeInitiated(address indexed sender, address indexed receiver, uint256 value, uint256 indexed destinationChainId, uint256 timestamp, bytes32 bridgeRequestId)",
  ];

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info({ chainId: this.chainId, rpc: config.sepoliaHttpUrl }, "Starting Sepolia Listener");

    try {
      this.provider = new ethers.JsonRpcProvider(config.sepoliaHttpUrl);
      const currentBlock = await this.provider.getBlockNumber();
      this.lastQueriedBlock = currentBlock;
      logger.info({ currentBlock }, "Connected to Sepolia RPC");

      if (config.bridgeSenderAddress && ethers.isAddress(config.bridgeSenderAddress)) {
        this.bridgeSenderContract = new ethers.Contract(
          config.bridgeSenderAddress,
          this.BRIDGE_SENDER_ABI,
          this.provider
        );
        logger.info({ address: config.bridgeSenderAddress }, "Monitoring MockBridgeSender contract on Sepolia");
      }

      // Robust fallback polling loop (every 6s for testnet block cadence)
      this.pollInterval = setInterval(() => this.pollBlocks(), 6000);
    } catch (err) {
      logger.error({ err }, "Failed to start Sepolia listener, will retry");
    }
  }

  private async pollBlocks(): Promise<void> {
    if (!this.provider || this.isPolling) return;
    this.isPolling = true;

    try {
      const latestBlock = await this.provider.getBlockNumber();
      if (latestBlock > this.lastQueriedBlock) {
        const fromBlock = this.lastQueriedBlock + 1;
        const toBlock = Math.min(latestBlock, fromBlock + 5);

        // 1. Check for contract events if contract is configured
        if (this.bridgeSenderContract) {
          const filter = this.bridgeSenderContract.filters.BridgeInitiated();
          const events = await this.bridgeSenderContract.queryFilter(filter, fromBlock, toBlock);

          for (const event of events) {
            const parsed = event as ethers.EventLog;
            const block = await this.provider.getBlock(parsed.blockNumber);

            const rawEvent: RawBlockchainEvent = {
              chainId: this.chainId,
              txHash: parsed.transactionHash,
              blockNumber: parsed.blockNumber,
              blockTimestamp: block ? Number(block.timestamp) : Math.floor(Date.now() / 1000),
              sender: parsed.args[0],
              receiver: parsed.args[1],
              valueWei: parsed.args[2].toString(),
              inputData: parsed.data,
              eventName: "BridgeInitiated",
              confirmations: latestBlock - parsed.blockNumber + 1,
            };

            logger.info({ txHash: rawEvent.txHash, value: rawEvent.valueWei }, "Captured Sepolia BridgeInitiated Event");
            await this.emitEvent(rawEvent);
          }
        }

        this.lastQueriedBlock = toBlock;
      }
    } catch (err) {
      logger.warn({ err }, "Error during Sepolia block polling cycle");
    } finally {
      this.isPolling = false;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    logger.info("Sepolia Listener stopped");
  }

  // Inject a synthetic or test transaction directly (used for test triggers)
  async ingestManualEvent(event: RawBlockchainEvent): Promise<void> {
    await this.emitEvent(event);
  }
}
