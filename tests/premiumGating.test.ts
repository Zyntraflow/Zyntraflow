import { describe, expect, it } from "vitest";
import { resolvePremiumDecision } from "../src/premium/premiumGating";

describe("resolvePremiumDecision", () => {
  it("enables premium options only when requested and access is true", () => {
    const result = resolvePremiumDecision({
      premiumRequested: true,
      hasAccess: true,
      reportPersistenceRequested: true,
      freeConcurrency: 2,
      premiumConcurrency: 5,
      freeMaxPairs: 1,
      premiumMaxPairs: 4,
    });

    expect(result.premiumActive).toBe(true);
    expect(result.mode).toBe("premium");
    expect(result.maxConcurrency).toBe(5);
    expect(result.maxPairs).toBe(4);
    expect(result.allowReportPersistence).toBe(true);
  });

  it("keeps free mode when access is missing", () => {
    const result = resolvePremiumDecision({
      premiumRequested: true,
      hasAccess: false,
      reportPersistenceRequested: true,
      freeConcurrency: 2,
      premiumConcurrency: 5,
      freeMaxPairs: 1,
      premiumMaxPairs: 4,
    });

    expect(result.premiumActive).toBe(false);
    expect(result.mode).toBe("free");
    expect(result.maxConcurrency).toBe(2);
    expect(result.maxPairs).toBe(1);
    expect(result.allowReportPersistence).toBe(false);
  });
});
