import { describe, expect, it } from "vitest";
import { estimateSlippagePercent } from "../src/simulation/slippage";

describe("estimateSlippagePercent", () => {
  it("returns ratio for normal values", () => {
    const slippage = estimateSlippagePercent({
      tradeSize: 2,
      liquidityDepth: 100,
    });

    expect(slippage).toBeCloseTo(0.02, 10);
  });

  it("clamps slippage to max 20%", () => {
    const slippage = estimateSlippagePercent({
      tradeSize: 80,
      liquidityDepth: 100,
    });

    expect(slippage).toBe(0.2);
  });

  it("returns zero for invalid or zero depth", () => {
    expect(
      estimateSlippagePercent({
        tradeSize: 1,
        liquidityDepth: 0,
      }),
    ).toBe(0);
  });
});
