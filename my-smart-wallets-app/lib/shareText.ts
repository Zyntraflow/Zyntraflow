import type { SignedFreeSummary } from "./feedSignature";

const shortenHash = (hash: string): string => {
  if (!hash || hash.length < 16) {
    return hash;
  }
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
};

export const buildXPostText = (signedSummary: SignedFreeSummary): string => {
  const pairsScanned = signedSummary.summary.pairsScanned;
  const topNet = signedSummary.summary.topOpportunities[0]?.netProfitEth ?? 0;
  const reportHash = shortenHash(signedSummary.summary.reportHash);
  const base = `@zyntraflow scan: ${pairsScanned} pairs | top net: ${topNet.toFixed(
    6,
  )} ETH | reportHash: ${reportHash} | verify: /api/feed/latest`;

  if (base.length <= 280) {
    return base;
  }

  return base.slice(0, 277).trimEnd() + "...";
};
