import { describe, expect, it } from "vitest";
import { detectOpportunities } from "../src/market/opportunityDetector";
import type { Quote } from "../src/market/types";

describe("detectOpportunities", () => {
  const quotes: Quote[] = [
    {
      pair: "ETH/USDC",
      source: "source-a",
      price: 2500,
      timestamp: "2026-02-18T00:00:00.000Z",
    },
    {
      pair: "ETH/USDC",
      source: "source-b",
      price: 2528,
      timestamp: "2026-02-18T00:00:00.000Z",
    },
  ];

  it("returns opportunities above the configured threshold", () => {
    const result = detectOpportunities({
      quotes,
      minProfitGap: 0.005,
    });

    expect(result.opportunityCount).toBe(1);
    expect(result.opportunities[0].buyFrom).toBe("source-a");
    expect(result.opportunities[0].sellTo).toBe("source-b");
  });

  it("returns no opportunities when threshold is too high", () => {
    const result = detectOpportunities({
      quotes,
      minProfitGap: 0.02,
    });

    expect(result.opportunityCount).toBe(0);
  });
});
