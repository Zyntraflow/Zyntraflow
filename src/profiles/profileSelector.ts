import { getChainConfig } from "../chains/chains";
import { getEnabledPairKeysForChain } from "../pairs/pairs";
import { getProfilePreset, listProfileIds, PROFILE_PRESETS } from "./presets";
import type { ScanProfile, SelectedScanProfile } from "./types";

const SAFE_MAX_PAIRS = 10;
const SAFE_MAX_CONCURRENCY = 3;
const SAFE_MIN_INTERVAL_SECONDS = 10;

type SelectProfileInput = {
  targetNetwork: string;
  defaultMinProfitGap: number;
  premiumEnabled: boolean;
  requestedProfileId?: string;
  requestedChains?: number[];
  requestedPairs?: string[];
  globalMaxConcurrency: number;
  globalIntervalSeconds: number;
};

const deriveDefaultProfileId = (targetNetwork: string, premiumEnabled: boolean): string => {
  const network = targetNetwork.trim().toLowerCase();
  if (network.includes("arbitrum")) {
    return premiumEnabled ? "arb_premium" : "arb_free";
  }
  return premiumEnabled ? "base_premium" : "base_free";
};

const sanitizePairList = (pairs: string[]): string[] => {
  return Array.from(
    new Set(
      pairs
        .map((pair) => pair.trim().toUpperCase())
        .filter((pair) => pair.length > 0),
    ),
  );
};

const resolveCustomProfile = (input: SelectProfileInput): ScanProfile => {
  const chains = input.requestedChains && input.requestedChains.length > 0 ? input.requestedChains : [8453];
  for (const chainId of chains) {
    getChainConfig(chainId);
  }

  const availablePairs = chains.flatMap((chainId) => getEnabledPairKeysForChain(chainId));
  const requestedPairs = sanitizePairList(input.requestedPairs ?? []);
  const pairs = requestedPairs.length > 0 ? requestedPairs : availablePairs;

  return {
    id: "custom",
    name: "Custom",
    chains,
    pairs,
    minProfitGap: input.defaultMinProfitGap,
    quoteSources: ["univ3"],
    maxConcurrency: 1,
    targetIntervalSeconds: input.globalIntervalSeconds,
    notes: "Custom profile built from CLI flags.",
  };
};

const fallbackFreeProfile = (profile: ScanProfile): ScanProfile | undefined => {
  if (!profile.premiumOnly) {
    return profile;
  }
  const fallbackId = profile.id.replace(/_premium$/i, "_free");
  return getProfilePreset(fallbackId);
};

export const getAvailableProfileIds = (): string[] => {
  return listProfileIds().concat("custom");
};

export const selectProfile = (input: SelectProfileInput): SelectedScanProfile => {
  const warnings: string[] = [];
  const requestedId = input.requestedProfileId ?? deriveDefaultProfileId(input.targetNetwork, input.premiumEnabled);

  const baseProfile =
    requestedId === "custom"
      ? resolveCustomProfile(input)
      : (() => {
          const preset = getProfilePreset(requestedId);
          if (!preset) {
            const available = getAvailableProfileIds().join(", ");
            throw new Error(`Invalid profile "${requestedId}". Available profiles: ${available}`);
          }
          return { ...preset };
        })();

  let chosenProfile = baseProfile;
  if (chosenProfile.premiumOnly && !input.premiumEnabled) {
    const fallback = fallbackFreeProfile(chosenProfile);
    if (!fallback) {
      throw new Error(`Profile "${chosenProfile.id}" requires premium access.`);
    }
    warnings.push(`Profile "${chosenProfile.id}" is premium-only; falling back to "${fallback.id}".`);
    chosenProfile = { ...fallback };
  }

  const sanitizedPairs = sanitizePairList(chosenProfile.pairs);
  const clampedPairs = sanitizedPairs.slice(0, SAFE_MAX_PAIRS);
  if (clampedPairs.length < sanitizedPairs.length) {
    warnings.push(`Pair list capped to ${SAFE_MAX_PAIRS} for safe runtime limits.`);
  }

  const requestedConcurrency = Math.max(1, chosenProfile.maxConcurrency);
  const clampedConcurrency = Math.max(
    1,
    Math.min(requestedConcurrency, SAFE_MAX_CONCURRENCY, Math.max(1, input.globalMaxConcurrency)),
  );
  if (clampedConcurrency !== requestedConcurrency) {
    warnings.push(`Concurrency clamped to ${clampedConcurrency}.`);
  }

  const requestedInterval = Math.max(chosenProfile.targetIntervalSeconds, input.globalIntervalSeconds);
  const clampedInterval = Math.max(requestedInterval, SAFE_MIN_INTERVAL_SECONDS);
  if (clampedInterval !== requestedInterval) {
    warnings.push(`Interval clamped to ${clampedInterval}s minimum.`);
  }

  const quoteSources = Array.from(new Set(chosenProfile.quoteSources));
  const normalizedProfile: SelectedScanProfile = {
    ...chosenProfile,
    chains: Array.from(new Set(chosenProfile.chains)),
    pairs: clampedPairs,
    quoteSources,
    maxConcurrency: clampedConcurrency,
    targetIntervalSeconds: clampedInterval,
    sourceProfileId: baseProfile.id,
    warnings,
  };

  return normalizedProfile;
};

export const PROFILE_METADATA = PROFILE_PRESETS;
