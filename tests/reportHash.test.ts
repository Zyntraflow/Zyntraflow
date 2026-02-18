import { describe, expect, it } from "vitest";
import { canonicalizeJson, computeReportHash } from "../src/reporting/reportHash";

describe("report hash", () => {
  it("returns the same hash for the same object", () => {
    const report = {
      chainId: 1,
      ts: "2026-01-01T00:00:00.000Z",
      simulations: [{ pair: "WETH/USDC", net: 0.1 }],
    };

    expect(computeReportHash(report)).toBe(computeReportHash(report));
  });

  it("is stable across key ordering differences", () => {
    const left = {
      b: 2,
      a: {
        z: true,
        m: [{ y: 2, x: 1 }],
      },
    };
    const right = {
      a: {
        m: [{ x: 1, y: 2 }],
        z: true,
      },
      b: 2,
    };

    expect(canonicalizeJson(left)).toBe(canonicalizeJson(right));
    expect(computeReportHash(left)).toBe(computeReportHash(right));
  });
});
