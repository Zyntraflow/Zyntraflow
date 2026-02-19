import { getAddress, getBytes, keccak256, toUtf8Bytes, verifyMessage } from "ethers";

export type FreeSummary = {
  ts: number;
  chainId: number;
  rpcName: string;
  pairsScanned: number;
  topOpportunities: Array<{
    pair: string;
    netProfitEth: number;
    riskFlags: string[];
  }>;
  reportHash: string;
  premiumAvailable: boolean;
};

export type SignedFreeSummary = {
  summary: FreeSummary;
  signerAddress: string;
  signature: string;
};

const canonicalize = (value: unknown): unknown => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const output: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      output[key] = canonicalize(entry);
    }
    return output;
  }
  return String(value);
};

export const verifySignedSummary = (payload: SignedFreeSummary): boolean => {
  const canonical = JSON.stringify(canonicalize(payload.summary));
  const hash = keccak256(toUtf8Bytes(canonical));
  const recovered = verifyMessage(getBytes(hash), payload.signature);
  return getAddress(recovered) === getAddress(payload.signerAddress);
};
