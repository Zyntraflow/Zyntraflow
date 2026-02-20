export type UiScanProfile = {
  id: "base_free" | "base_premium" | "arb_free" | "arb_premium";
  name: string;
  chains: number[];
  pairs: string[];
  quoteSources: Array<"univ2" | "univ3">;
  minProfitGap: number;
  maxConcurrency: number;
  premiumOnly?: boolean;
  notes: string;
};

export const PROFILE_STORAGE_KEY = "zyntraflow.scanProfile";

export const UI_SCAN_PROFILES: UiScanProfile[] = [
  {
    id: "base_free",
    name: "Base Free",
    chains: [8453],
    pairs: ["WETH/USDC"],
    quoteSources: ["univ3"],
    minProfitGap: 0.01,
    maxConcurrency: 1,
    notes: "Conservative Base scan profile for public mode.",
  },
  {
    id: "base_premium",
    name: "Base Premium",
    chains: [8453],
    pairs: ["WETH/USDC", "WETH/DAI"],
    quoteSources: ["univ2", "univ3"],
    minProfitGap: 0.005,
    maxConcurrency: 3,
    premiumOnly: true,
    notes: "Expanded Base scan coverage for premium users.",
  },
  {
    id: "arb_free",
    name: "Arbitrum Free",
    chains: [42161],
    pairs: ["WETH/USDC"],
    quoteSources: ["univ3"],
    minProfitGap: 0.01,
    maxConcurrency: 1,
    notes: "Conservative Arbitrum profile.",
  },
  {
    id: "arb_premium",
    name: "Arbitrum Premium",
    chains: [42161],
    pairs: ["WETH/USDC", "WETH/DAI"],
    quoteSources: ["univ2", "univ3"],
    minProfitGap: 0.005,
    maxConcurrency: 3,
    premiumOnly: true,
    notes: "Broader Arbitrum profile for premium mode.",
  },
];

export const DEFAULT_UI_PROFILE_ID: UiScanProfile["id"] = "base_free";

export const getUiProfile = (profileId: string | null | undefined): UiScanProfile | null => {
  if (!profileId) {
    return null;
  }
  return UI_SCAN_PROFILES.find((profile) => profile.id === profileId) ?? null;
};

export const getDefaultUiProfile = (): UiScanProfile => {
  return getUiProfile(DEFAULT_UI_PROFILE_ID) ?? UI_SCAN_PROFILES[0];
};

export const readSavedProfileId = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(PROFILE_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const saveProfileId = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, profileId);
  } catch {
    // Ignore storage write failures.
  }
};
