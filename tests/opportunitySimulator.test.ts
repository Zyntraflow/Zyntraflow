import { describe, expect, it } from "vitest";
import { simulateOpportunity } from "../src/simulation/opportunitySimulator";

describe("simulateOpportunity", () => {
  it("computes net result and threshold pass for profitable setup", () => {
    const result = simulateOpportunity({
      grossGap: 0.02,
      tradeSizeEth: 1,
      gasPriceGwei: 20,
      gasLimit: 150000,
      liquidityDepth: 100,
      minProfitGap: 0.001,
    });

    expect(result.grossProfitEth).toBeCloseTo(0.02, 10);
    expect(result.netProfitEth).toBeGreaterThan(0.001);
    expect(result.passesThreshold).toBe(true);
    expect(result.riskFlags).not.toContain("NEGATIVE_PROFIT");
  });

  it("adds expected risk flags when simulation is weak", () => {
    const result = simulateOpportunity({
      grossGap: 0.001,
      tradeSizeEth: 10,
      gasPriceGwei: 80,
      gasLimit: 300000,
      liquidityDepth: 50,
      minProfitGap: 0.01,
    });

    expect(result.slippagePercent).toBe(0.2);
    expect(result.passesThreshold).toBe(false);
    expect(result.riskFlags).toContain("HIGH_SLIPPAGE");
    expect(result.riskFlags).toContain("LOW_NET_MARGIN");
    expect(result.riskFlags).toContain("NEGATIVE_PROFIT");
  });
});
