import { describe, expect, it } from "vitest";
import { filterAlerts, getChainFilterOptions, type AlertEventLite } from "../my-smart-wallets-app/lib/alertsFilters";
import type { UiScanProfile } from "../my-smart-wallets-app/lib/profiles";

const events: AlertEventLite[] = [
  { chainId: 8453, pair: "WETH/USDC", mode: "premium" },
  { chainId: 42161, pair: "WETH/USDC", mode: "free" },
  { chainId: 8453, pair: "WETH/DAI", mode: "free" },
];

const baseProfile: UiScanProfile = {
  id: "base_free",
  name: "Base Free",
  chains: [8453],
  pairs: ["WETH/USDC"],
  minProfitGap: 0.01,
  quoteSources: ["univ2"],
  maxConcurrency: 2,
};

describe("alerts filters", () => {
  it("filters by chain and mode", () => {
    const filtered = filterAlerts({
      events,
      chainIdFilter: 8453,
      modeFilter: "premium",
      profileFilter: null,
    });
    expect(filtered).toEqual([{ chainId: 8453, pair: "WETH/USDC", mode: "premium" }]);
  });

  it("filters by selected profile coverage", () => {
    const filtered = filterAlerts({
      events,
      chainIdFilter: "all",
      modeFilter: "all",
      profileFilter: baseProfile,
    });
    expect(filtered).toEqual([{ chainId: 8453, pair: "WETH/USDC", mode: "premium" }]);
  });

  it("derives unique sorted chain options", () => {
    expect(getChainFilterOptions(events)).toEqual([8453, 42161].sort((a, b) => a - b));
  });
});

