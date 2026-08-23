import { EventHandler } from "./types.js";
import { logger } from "../utils/logger.js";

export abstract class BaseEventListener {
  protected handlers: EventHandler[] = [];
  protected isRunning = false;
  public abstract readonly chainId: number;
  public abstract readonly name: string;

  onEvent(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  protected async emitEvent(event: Parameters<EventHandler>[0]): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(event);
      } catch (err) {
        logger.error({ err, chainId: this.chainId, txHash: event.txHash }, "Error in event handler callback");
      }
    }
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}
