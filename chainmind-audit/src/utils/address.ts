import { getAddress, isAddress } from "ethers";

/**
 * Normalizes an Ethereum address to checksummed format.
 * Returns lowercase fallback if invalid address format.
 */
export function normalizeAddress(address: string): string {
  if (!address) return "";
  const cleaned = address.trim();
  if (isAddress(cleaned)) {
    return getAddress(cleaned);
  }
  return cleaned.toLowerCase();
}
