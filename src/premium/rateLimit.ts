import fs from "fs";
import path from "path";
import { getAddress } from "ethers";

export type RateLimitState = {
  windowStart: number;
  count: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  windowResetAt: number;
  state: RateLimitState;
};

type RateLimitInput = {
  walletAddress: string;
  maxPackagesPerHour: number;
  windowSeconds: number;
  baseDir?: string;
  nowUnixSeconds?: number;
};

const readState = (statePath: string): RateLimitState | null => {
  if (!fs.existsSync(statePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<RateLimitState>;
    if (
      typeof parsed.windowStart !== "number" ||
      !Number.isFinite(parsed.windowStart) ||
      typeof parsed.count !== "number" ||
      !Number.isFinite(parsed.count)
    ) {
      return null;
    }
    return {
      windowStart: Math.floor(parsed.windowStart),
      count: Math.floor(parsed.count),
    };
  } catch {
    return null;
  }
};

const writeState = (statePath: string, state: RateLimitState): void => {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), { encoding: "utf8" });
};

export const checkAndConsumePremiumRateLimit = (input: RateLimitInput): RateLimitDecision => {
  if (!Number.isInteger(input.maxPackagesPerHour) || input.maxPackagesPerHour <= 0) {
    throw new Error("maxPackagesPerHour must be a positive integer.");
  }
  if (!Number.isInteger(input.windowSeconds) || input.windowSeconds <= 0) {
    throw new Error("windowSeconds must be a positive integer.");
  }

  const wallet = getAddress(input.walletAddress).toLowerCase();
  const baseDir = input.baseDir ?? process.cwd();
  const now = input.nowUnixSeconds ?? Math.floor(Date.now() / 1000);
  const stateDir = path.join(baseDir, "reports", "rate-limit");
  const statePath = path.join(stateDir, `${wallet}.json`);
  fs.mkdirSync(stateDir, { recursive: true });

  const stored = readState(statePath);
  const windowStart = stored && now < stored.windowStart + input.windowSeconds ? stored.windowStart : now;
  const count = stored && now < stored.windowStart + input.windowSeconds ? stored.count : 0;

  if (count >= input.maxPackagesPerHour) {
    return {
      allowed: false,
      remaining: 0,
      windowResetAt: windowStart + input.windowSeconds,
      state: { windowStart, count },
    };
  }

  const updatedState: RateLimitState = {
    windowStart,
    count: count + 1,
  };
  writeState(statePath, updatedState);

  return {
    allowed: true,
    remaining: Math.max(0, input.maxPackagesPerHour - updatedState.count),
    windowResetAt: windowStart + input.windowSeconds,
    state: updatedState,
  };
};
