import { promises as fs } from "fs";
import path from "path";
import { getAddress } from "ethers";
import type { ScanReport } from "../scanner/scanEngine";
import type { Subscription } from "../subscriptions/types";

const FREE_MIN_NET_PROFIT_ETH = 0.01;
const FREE_MAX_SLIPPAGE_PERCENT = 0.02;
const DEFAULT_LATEST_LIMIT = 20;

export type AlertMode = "free" | "premium";

export type AlertEvent = {
  ts: string;
  userAddress: string;
  reportHash: string;
  chainId: number;
  pair: string;
  netProfitEth: number;
  gasCostEth: number;
  slippagePercent: number;
  riskFlags: string[];
  score: number;
  mode: AlertMode;
  notes: string[];
  signedFreeSummaryUrl: string;
  premiumPackageUrl?: string;
  webhookUrl?: string;
};

export type AlertLatestSnapshot = {
  updatedAt: string;
  global: AlertEvent[];
  byUser: Record<string, AlertEvent[]>;
};

export type BuildAlertsInput = {
  scanReport: ScanReport;
  reportHash: string;
  subscriptions: Subscription[];
  isPremiumAddress: (address: string) => Promise<boolean>;
  signedFreeSummaryUrl: string;
  premiumPackageUrlByAddress?: Record<string, string>;
};

export type BuildAlertsResult = {
  events: AlertEvent[];
  errors: string[];
};

const defaultLatestSnapshot = (): AlertLatestSnapshot => ({
  updatedAt: new Date().toISOString(),
  global: [],
  byUser: {},
});

const alertsDir = (baseDir: string): string => path.join(baseDir, "reports", "alerts");

const isPairAllowed = (pair: string, pairs?: string[]): boolean => {
  if (!pairs || pairs.length === 0) {
    return true;
  }

  return pairs.some((entry) => entry.toUpperCase() === pair.toUpperCase());
};

const normalizeThresholds = (subscription: Subscription, mode: AlertMode): {
  minNetProfitEth: number;
  maxSlippagePercent: number;
  notes: string[];
} => {
  if (mode === "premium") {
    return {
      minNetProfitEth: subscription.minNetProfitEth,
      maxSlippagePercent: subscription.maxSlippagePercent,
      notes: [],
    };
  }

  const notes: string[] = [];
  const minNetProfitEth = Math.max(subscription.minNetProfitEth, FREE_MIN_NET_PROFIT_ETH);
  const maxSlippagePercent = Math.min(subscription.maxSlippagePercent, FREE_MAX_SLIPPAGE_PERCENT);

  if (minNetProfitEth !== subscription.minNetProfitEth) {
    notes.push(`minNetProfitEth clamped to ${FREE_MIN_NET_PROFIT_ETH}`);
  }
  if (maxSlippagePercent !== subscription.maxSlippagePercent) {
    notes.push(`maxSlippagePercent clamped to ${FREE_MAX_SLIPPAGE_PERCENT}`);
  }

  return {
    minNetProfitEth,
    maxSlippagePercent,
    notes,
  };
};

export const buildAlertEvents = async (input: BuildAlertsInput): Promise<BuildAlertsResult> => {
  const events: AlertEvent[] = [];
  const errors: string[] = [];

  const ranked = input.scanReport.rankedOpportunities.slice().sort((left, right) => right.score - left.score);
  for (const subscription of input.subscriptions) {
    let normalizedAddress: string;
    try {
      normalizedAddress = getAddress(subscription.userAddress);
    } catch {
      errors.push("Invalid subscription address encountered.");
      continue;
    }

    if (!subscription.chains.includes(input.scanReport.chainId)) {
      continue;
    }

    let mode: AlertMode = "free";
    try {
      mode = (await input.isPremiumAddress(normalizedAddress)) ? "premium" : "free";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`premium-check ${normalizedAddress}: ${message}`);
    }

    const thresholds = normalizeThresholds(subscription, mode);
    const matched = ranked.find((opportunity) => {
      if (!isPairAllowed(opportunity.pair, subscription.pairs)) {
        return false;
      }

      return (
        opportunity.simulation.netProfitEth >= thresholds.minNetProfitEth &&
        opportunity.simulation.slippagePercent <= thresholds.maxSlippagePercent
      );
    });

    if (!matched) {
      continue;
    }

    events.push({
      ts: new Date().toISOString(),
      userAddress: normalizedAddress,
      reportHash: input.reportHash,
      chainId: input.scanReport.chainId,
      pair: matched.pair,
      netProfitEth: matched.simulation.netProfitEth,
      gasCostEth: matched.simulation.gasCostEth,
      slippagePercent: matched.simulation.slippagePercent,
      riskFlags: matched.simulation.riskFlags,
      score: matched.score,
      mode,
      notes: thresholds.notes,
      signedFreeSummaryUrl: input.signedFreeSummaryUrl,
      premiumPackageUrl: input.premiumPackageUrlByAddress?.[normalizedAddress.toLowerCase()],
      webhookUrl: subscription.delivery.webhookUrl,
    });
  }

  return { events, errors };
};

const readLatestSnapshot = async (filePath: string): Promise<AlertLatestSnapshot> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AlertLatestSnapshot>;
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      global: Array.isArray(parsed.global) ? (parsed.global as AlertEvent[]) : [],
      byUser:
        parsed.byUser && typeof parsed.byUser === "object" && !Array.isArray(parsed.byUser)
          ? (parsed.byUser as Record<string, AlertEvent[]>)
          : {},
    };
  } catch {
    return defaultLatestSnapshot();
  }
};

const mergeLatest = (existing: AlertLatestSnapshot, events: AlertEvent[], limit: number): AlertLatestSnapshot => {
  const global = [...events, ...existing.global].slice(0, limit);
  const byUser: Record<string, AlertEvent[]> = { ...existing.byUser };

  for (const event of events) {
    const key = event.userAddress.toLowerCase();
    const current = byUser[key] ?? [];
    byUser[key] = [event, ...current].slice(0, limit);
  }

  return {
    updatedAt: new Date().toISOString(),
    global,
    byUser,
  };
};

export const persistAlerts = async (
  events: AlertEvent[],
  options?: { baseDir?: string; now?: Date; latestLimit?: number },
): Promise<{ jsonlPath: string; latestPath: string }> => {
  const baseDir = options?.baseDir ?? process.cwd();
  const now = options?.now ?? new Date();
  const latestLimit = options?.latestLimit ?? DEFAULT_LATEST_LIMIT;
  const day = now.toISOString().slice(0, 10);

  const dir = alertsDir(baseDir);
  const jsonlPath = path.join(dir, `${day}.jsonl`);
  const latestPath = path.join(dir, "latest.json");
  await fs.mkdir(dir, { recursive: true });

  if (events.length > 0) {
    const lines = events.map((event) => JSON.stringify(event)).join("\n");
    await fs.appendFile(jsonlPath, `${lines}\n`, { encoding: "utf8" });
  } else {
    await fs.writeFile(jsonlPath, "", { encoding: "utf8", flag: "a" });
  }

  const existingLatest = await readLatestSnapshot(latestPath);
  const nextLatest = mergeLatest(existingLatest, events, latestLimit);
  await fs.writeFile(latestPath, `${JSON.stringify(nextLatest, null, 2)}\n`, { encoding: "utf8" });

  return { jsonlPath, latestPath };
};

export const readLatestAlerts = async (
  options?: { baseDir?: string },
): Promise<AlertLatestSnapshot> => {
  const baseDir = options?.baseDir ?? process.cwd();
  const latestPath = path.join(alertsDir(baseDir), "latest.json");
  return readLatestSnapshot(latestPath);
};
