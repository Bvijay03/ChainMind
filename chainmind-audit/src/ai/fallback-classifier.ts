import { SemanticIntent } from "../storage/types.js";
import { IntentResult } from "./types.js";

/**
 * Deterministic fallback classifier using EVM 4-byte function selectors and heuristics.
 * Guarantees zero hallucinations and <1ms execution latency when LLM is offline or timed out.
 */
export class FallbackClassifier {
  private static readonly SELECTOR_MAP: Record<string, { intent: SemanticIntent; reasoning: string }> = {
    // Bridge selectors
    "0x8b95dd71": { intent: "BRIDGE_INITIATE", reasoning: "Matches initiateBridge(address,uint256)" },
    "0x4e71d92d": { intent: "BRIDGE_COMPLETE", reasoning: "Matches completeBridge(address,address,uint256,uint256,bytes32)" },
    "0x8b857700": { intent: "BRIDGE_INITIATE", reasoning: "Matches bridgeOut / depositToBridge pattern" },
    "0x9c4cdb64": { intent: "BRIDGE_COMPLETE", reasoning: "Matches bridgeIn / finalizeBridge pattern" },
    
    // ERC-20 / Transfers
    "0xa9059cbb": { intent: "TRANSFER", reasoning: "Standard ERC-20 transfer(address,uint256)" },
    "0x23b872dd": { intent: "TRANSFER", reasoning: "Standard ERC-20 transferFrom(address,address,uint256)" },
    
    // Swaps (Uniswap V2/V3)
    "0x38ed1739": { intent: "SWAP", reasoning: "Uniswap swapExactTokensForTokens" },
    "0x7ff36ab5": { intent: "SWAP", reasoning: "Uniswap swapExactETHForTokens" },
    "0x18cbafe5": { intent: "SWAP", reasoning: "Uniswap swapExactTokensForETH" },
    "0x5ae401dc": { intent: "SWAP", reasoning: "Uniswap V3 multicall swap" },
    "0x414bf389": { intent: "SWAP", reasoning: "Uniswap V3 exactInputSingle" },

    // Deposits & Withdrawals
    "0xd0e30db0": { intent: "DEPOSIT", reasoning: "WETH deposit()" },
    "0x2e1a7d4d": { intent: "WITHDRAW", reasoning: "WETH withdraw(uint256)" },
    "0xb6b55f25": { intent: "DEPOSIT", reasoning: "ERC-4626 deposit(uint256,address)" },
    "0xba087652": { intent: "WITHDRAW", reasoning: "ERC-4626 withdraw(uint256,address,address)" },
  };

  static classify(
    functionSelector: string | null,
    valueWei: string,
    inputData: string | null
  ): IntentResult {
    // 1. Selector match
    if (functionSelector) {
      const match = this.SELECTOR_MAP[functionSelector.toLowerCase()];
      if (match) {
        return {
          intent: match.intent,
          confidenceScore: 0.99,
          source: "RULE_BASED",
          reasoning: match.reasoning,
        };
      }
    }

    // 2. Pure ETH transfer heuristic
    if ((!inputData || inputData === "0x") && BigInt(valueWei || "0") > 0n) {
      return {
        intent: "TRANSFER",
        confidenceScore: 0.95,
        source: "RULE_BASED",
        reasoning: "Native ETH value transfer with empty calldata",
      };
    }

    // 3. Fallback UNKNOWN
    return {
      intent: "UNKNOWN",
      confidenceScore: 0.30,
      source: "RULE_BASED",
      reasoning: "Unrecognized function selector and calldata signature",
    };
  }
}
