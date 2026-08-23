import { BaseEventListener } from "./base-listener.js";
import { RawBlockchainEvent } from "./types.js";
import { logger } from "../utils/logger.js";
import { ethers } from "ethers";

export class SimulatorListener extends BaseEventListener {
  public readonly chainId = 17000; // Simulated Destination Chain (e.g., Hoodi / Secondary EVM)
  public readonly name = "Simulated Chain B";
  private mockInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info({ chainId: this.chainId }, "Simulator Listener (Chain B) started");
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }
    logger.info("Simulator Listener stopped");
  }

  /**
   * Simulates a counterpart bridge completion event on Chain B with a delay.
   */
  simulateCounterpartEvent(
    sourceTxHash: string,
    sender: string,
    receiver: string,
    valueWei: string,
    sourceTimestamp: number,
    delaySeconds = 5,
    valueModifierRatio = 1.0 // 1.0 for exact, 0.99 for 1% slippage/fee, 0.5 for mismatch
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(async () => {
        if (!this.isRunning) {
          resolve();
          return;
        }

        const modifiedValue = (BigInt(valueWei) * BigInt(Math.round(valueModifierRatio * 1000))) / 1000n;
        const counterpartTimestamp = sourceTimestamp + delaySeconds;
        const fakeTxHash = ethers.keccak256(
          ethers.toUtf8Bytes(`chainB-${sourceTxHash}-${Date.now()}`)
        );

        const simulatedEvent: RawBlockchainEvent = {
          chainId: this.chainId,
          txHash: fakeTxHash,
          blockNumber: 5432100 + Math.floor(Math.random() * 100),
          blockTimestamp: counterpartTimestamp,
          sender: sender,
          receiver: receiver,
          valueWei: modifiedValue.toString(),
          inputData: "0x4e71d92d" + "0".repeat(56), // Mock completeBridge selector
          eventName: "BridgeCompleted",
          confirmations: 12,
        };

        logger.info(
          { chainId: this.chainId, txHash: fakeTxHash, value: simulatedEvent.valueWei },
          "Emitted simulated Chain B BridgeCompleted event"
        );

        await this.emitEvent(simulatedEvent);
        resolve();
      }, delaySeconds * 1000);
    });
  }

  async ingestManualEvent(event: RawBlockchainEvent): Promise<void> {
    await this.emitEvent(event);
  }
}
