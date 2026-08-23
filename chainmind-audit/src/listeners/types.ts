export interface RawBlockchainEvent {
  chainId: number;
  txHash: string;
  blockNumber: number;
  blockTimestamp: number;
  sender: string;
  receiver: string;
  valueWei: string;
  inputData?: string | null;
  eventName?: string;
  eventSignature?: string;
  confirmations?: number;
}

export type EventHandler = (event: RawBlockchainEvent) => Promise<void> | void;
