import { describe, expect, it } from "vitest";
import { getAvailableProfileIds, selectProfile } from "../src/profiles/profileSelector";

describe("profileSelector", () => {
  it("falls back to free profile when premium profile is requested without premium access", () => {
    const selected = selectProfile({
      targetNetwork: "base",
      defaultMinProfitGap: 0.01,
      premiumEnabled: false,
      requestedProfileId: "base_premium",
      globalMaxConcurrency: 2,
      globalIntervalSeconds: 30,
    });

    expect(selected.id).toBe("base_free");
    expect(selected.sourceProfileId).toBe("base_premium");
    expect(selected.warnings.join(" ")).toContain("premium-only");
  });

  it("builds custom profile from CLI chains and pairs with safety clamps", () => {
    const selected = selectProfile({
      targetNetwork: "base",
      defaultMinProfitGap: 0.02,
      premiumEnabled: true,
      requestedProfileId: "custom",
      requestedChains: [8453, 42161],
      requestedPairs: ["WETH/USDC", "WETH/DAI"],
      globalMaxConcurrency: 1,
      globalIntervalSeconds: 5,
    });

    expect(selected.id).toBe("custom");
    expect(selected.chains).toEqual([8453, 42161]);
    expect(selected.pairs).toEqual(["WETH/USDC", "WETH/DAI"]);
    expect(selected.maxConcurrency).toBe(1);
    expect(selected.targetIntervalSeconds).toBe(10);
  });

  it("throws for unknown profile id and lists valid profile IDs", () => {
    expect(() =>
      selectProfile({
        targetNetwork: "base",
        defaultMinProfitGap: 0.01,
        premiumEnabled: false,
        requestedProfileId: "does_not_exist",
        globalMaxConcurrency: 2,
        globalIntervalSeconds: 30,
      }),
    ).toThrow("Available profiles");

    expect(getAvailableProfileIds()).toContain("custom");
  });
});
