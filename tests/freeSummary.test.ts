import { describe, expect, it } from "vitest";
import { buildFreeSummary } from "../src/reporting/freeSummary";
import type { ScanReport } from "../src/scanner/scanEngine";

const buildScanReport = (): ScanReport => {
  return {
    ts: "2026-01-01T00:00:00.000Z",
    chainId: 1,
    rpcEndpoint: "primary",
    pairsScanned: 2,
    opportunities: [],
    simulations: [
      {
        chainId: 1,
        pair: "WETH/USDC",
        buyFrom: "mock",
        sellTo: "onchain_univ2",
        grossGap: 0.05,
        quoteInputs: [],
        simulation: {
          grossProfitEth: 0.05,
          netProfitEth: 0.03,
          gasCostEth: 0.002,
          slippagePercent: 0.01,
          passesThreshold: true,
          riskFlags: [],
        },
      },
      {
        chainId: 1,
        pair: "WETH/DAI",
        buyFrom: "mock",
        sellTo: "onchain_univ2",
        grossGap: 0.02,
        quoteInputs: [],
        simulation: {
          grossProfitEth: 0.02,
          netProfitEth: 0.01,
          gasCostEth: 0.002,
          slippagePercent: 0.01,
          passesThreshold: true,
          riskFlags: ["LOW_NET_MARGIN"],
        },
      },
    ],
    rankedOpportunities: [
      {
        chainId: 1,
        pair: "WETH/USDC",
        buyFrom: "mock",
        sellTo: "onchain_univ2",
        grossGap: 0.05,
        quoteInputs: [],
        simulation: {
          grossProfitEth: 0.05,
          netProfitEth: 0.03,
          gasCostEth: 0.002,
          slippagePercent: 0.01,
          passesThreshold: true,
          riskFlags: [],
        },
        score: 0.4,
      },
      {
        chainId: 1,
        pair: "WETH/DAI",
        buyFrom: "mock",
        sellTo: "onchain_univ2",
        grossGap: 0.02,
        quoteInputs: [],
        simulation: {
          grossProfitEth: 0.02,
          netProfitEth: 0.01,
          gasCostEth: 0.002,
          slippagePercent: 0.01,
          passesThreshold: true,
          riskFlags: ["LOW_NET_MARGIN"],
        },
        score: 0.1,
      },
    ],
    errors: [],
  };
};

describe("free summary", () => {
  it("includes report hash and top opportunities only", () => {
    const summary = buildFreeSummary(buildScanReport(), "0x" + "ab".repeat(32), {
      topN: 1,
      premiumAvailable: true,
    });

    expect(summary.reportHash).toBe("0x" + "ab".repeat(32));
    expect(summary.topOpportunities).toHaveLength(1);
    expect(summary.topOpportunities[0].pair).toBe("WETH/USDC");
    expect(summary.topOpportunities[0].chainId).toBe(1);
    expect(summary.topOpportunities[0].score).toBe(0.4);
    expect(summary.premiumAvailable).toBe(true);
  });

  it("does not include restricted premium fields", () => {
    const summary = buildFreeSummary(buildScanReport(), "0x" + "cd".repeat(32));
    const serialized = JSON.stringify(summary);

    expect(serialized.includes("ciphertextBase64")).toBe(false);
    expect(serialized.includes("signature")).toBe(false);
    expect(serialized.includes("userAddress")).toBe(false);
    expect(serialized.includes("ALCHEMY_URL")).toBe(false);
  });
});
