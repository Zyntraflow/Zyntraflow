import { describe, expect, it } from "vitest";
import { estimateGasCost } from "../src/simulation/costModel";

describe("estimateGasCost", () => {
  it("calculates gas cost in eth", () => {
    const result = estimateGasCost({
      gasPriceGwei: 20,
      gasLimit: 21000,
    });

    expect(result.gasCostEth).toBeCloseTo(0.00042, 10);
    expect(result.gasCostUsd).toBeUndefined();
  });

  it("calculates gas cost in usd when eth price is provided", () => {
    const result = estimateGasCost({
      gasPriceGwei: 30,
      gasLimit: 200000,
      ethPriceUsd: 3000,
    });

    expect(result.gasCostEth).toBeCloseTo(0.006, 10);
    expect(result.gasCostUsd).toBeCloseTo(18, 10);
  });
});
