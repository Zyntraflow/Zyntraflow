import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import type { FreeSummary } from "../src/reporting/freeSummary";
import { signFreeSummary, verifyFreeSummary } from "../src/reporting/freeSummarySigned";

const baseSummary: FreeSummary = {
  ts: 1771400000,
  chainId: 1,
  rpcName: "primary",
  pairsScanned: 2,
  topOpportunities: [
    {
      chainId: 1,
      pair: "WETH/USDC",
      netProfitEth: 0.04,
      gasCostEth: 0.002,
      slippagePercent: 0.01,
      riskFlags: [],
      score: 0.3,
    },
  ],
  reportHash: "0x" + "ab".repeat(32),
  premiumAvailable: true,
};

describe("free summary signed", () => {
  it("verifies signature for unmodified summary", async () => {
    const signer = Wallet.createRandom();
    const signed = await signFreeSummary(baseSummary, signer.privateKey);

    expect(signed.signerAddress).toBe(signer.address);
    expect(verifyFreeSummary(signed)).toBe(true);
  });

  it("fails verification when summary is modified", async () => {
    const signer = Wallet.createRandom();
    const signed = await signFreeSummary(baseSummary, signer.privateKey);
    const tampered = {
      ...signed,
      summary: {
        ...signed.summary,
        pairsScanned: signed.summary.pairsScanned + 1,
      },
    };

    expect(verifyFreeSummary(tampered)).toBe(false);
  });
});
