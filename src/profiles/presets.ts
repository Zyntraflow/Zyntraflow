import { getEnabledPairKeysForChain } from "../pairs/pairs";
import type { ScanProfile } from "./types";

const basePairKeys = getEnabledPairKeysForChain(8453);
const arbPairKeys = getEnabledPairKeysForChain(42161);

const firstPair = (pairKeys: string[]): string[] => {
  return pairKeys.length > 0 ? [pairKeys[0]] : [];
};

export const PROFILE_PRESETS: Record<string, ScanProfile> = {
  base_free: {
    id: "base_free",
    name: "Base Free",
    chains: [8453],
    pairs: firstPair(basePairKeys),
    minProfitGap: 0.01,
    quoteSources: ["univ3"],
    maxConcurrency: 1,
    targetIntervalSeconds: 30,
    notes: "Mobile-safe default on Base with conservative scan breadth.",
  },
  base_premium: {
    id: "base_premium",
    name: "Base Premium",
    chains: [8453],
    pairs: basePairKeys,
    minProfitGap: 0.005,
    quoteSources: ["univ2", "univ3"],
    maxConcurrency: 3,
    targetIntervalSeconds: 15,
    premiumOnly: true,
    notes: "Broader Base profile with lower threshold and more quote source coverage.",
  },
  arb_free: {
    id: "arb_free",
    name: "Arbitrum Free",
    chains: [42161],
    pairs: firstPair(arbPairKeys),
    minProfitGap: 0.01,
    quoteSources: ["univ3"],
    maxConcurrency: 1,
    targetIntervalSeconds: 30,
    notes: "Conservative Arbitrum preset for public mode.",
  },
  arb_premium: {
    id: "arb_premium",
    name: "Arbitrum Premium",
    chains: [42161],
    pairs: arbPairKeys,
    minProfitGap: 0.005,
    quoteSources: ["univ2", "univ3"],
    maxConcurrency: 3,
    targetIntervalSeconds: 15,
    premiumOnly: true,
    notes: "Premium Arbitrum preset with larger pair set and faster cadence target.",
  },
};

export const listProfileIds = (): string[] => Object.keys(PROFILE_PRESETS);

export const getProfilePreset = (profileId: string): ScanProfile | undefined => {
  return PROFILE_PRESETS[profileId];
};
