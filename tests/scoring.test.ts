import { describe, expect, it } from "vitest";
import { scoreOpportunity } from "../src/market/scoring";
import type { SimulationResult } from "../src/simulation/opportunitySimulator";

const baseSimulation = (overrides?: Partial<SimulationResult>): SimulationResult => ({
  grossProfitEth: 0.05,
  netProfitEth: 0.03,
  gasCostEth: 0.002,
  slippagePercent: 0.01,
  passesThreshold: true,
  riskFlags: [],
  ...overrides,
});

describe("scoreOpportunity", () => {
  it("rewards higher net profit and gas efficiency", () => {
    const low = baseSimulation({ netProfitEth: 0.01, gasCostEth: 0.005 });
    const high = baseSimulation({ netProfitEth: 0.03, gasCostEth: 0.002 });

    expect(scoreOpportunity(high)).toBeGreaterThan(scoreOpportunity(low));
  });

  it("applies slippage and margin penalties", () => {
    const clean = baseSimulation();
    const penalized = baseSimulation({
      riskFlags: ["HIGH_SLIPPAGE", "LOW_NET_MARGIN"],
    });

    expect(scoreOpportunity(clean)).toBeGreaterThan(scoreOpportunity(penalized));
  });

  it("returns strongly negative score for negative profit", () => {
    const negative = baseSimulation({
      netProfitEth: -0.001,
      riskFlags: ["NEGATIVE_PROFIT"],
    });

    expect(scoreOpportunity(negative)).toBe(-1_000_000);
  });
});
