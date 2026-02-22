import fs from "fs";
import path from "path";
import { createKillSwitch, isKillSwitchActive } from "./killSwitch";
import type { RpcProviderClient } from "../rpc/manager";

export type PendingExecutionTx = {
  txHash: string;
  chainId: number;
  reportHash: string;
  opportunityId: string;
  to: string;
  sentAtMs: number;
  stuckAlertedAtMs?: number;
};

type PendingState = {
  updatedAt: string;
  pending: PendingExecutionTx[];
};

export type StuckTxCheckResult = {
  triggered: boolean;
  stuck: PendingExecutionTx[];
  pendingCount: number;
  oldestPendingAgeSeconds: number;
};

const PENDING_FILE = path.join("reports", "execution", "pending.json");

const defaultPendingState = (): PendingState => ({
  updatedAt: new Date().toISOString(),
  pending: [],
});

const resolvePendingPath = (baseDir = process.cwd()): string => path.join(baseDir, PENDING_FILE);

const writePendingState = (state: PendingState, baseDir = process.cwd()): void => {
  const filePath = resolvePendingPath(baseDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8" });
  fs.renameSync(tmp, filePath);
};

export const readPendingState = (baseDir = process.cwd()): PendingState => {
  const filePath = resolvePendingPath(baseDir);
  if (!fs.existsSync(filePath)) {
    return defaultPendingState();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<PendingState>;
    const pending = Array.isArray(parsed.pending)
      ? parsed.pending
          .filter((entry): entry is PendingExecutionTx => {
            if (!entry || typeof entry !== "object") {
              return false;
            }
            const candidate = entry as Partial<PendingExecutionTx>;
            return (
              typeof candidate.txHash === "string" &&
              /^0x[a-fA-F0-9]{64}$/.test(candidate.txHash) &&
              typeof candidate.chainId === "number" &&
              Number.isInteger(candidate.chainId) &&
              candidate.chainId > 0 &&
              typeof candidate.reportHash === "string" &&
              candidate.reportHash.length > 0 &&
              typeof candidate.opportunityId === "string" &&
              candidate.opportunityId.length > 0 &&
              typeof candidate.to === "string" &&
              candidate.to.length > 0 &&
              typeof candidate.sentAtMs === "number" &&
              Number.isFinite(candidate.sentAtMs)
            );
          })
          .map((entry) => ({
            ...entry,
            stuckAlertedAtMs:
              typeof entry.stuckAlertedAtMs === "number" && Number.isFinite(entry.stuckAlertedAtMs)
                ? entry.stuckAlertedAtMs
                : undefined,
          }))
      : [];
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      pending,
    };
  } catch {
    return defaultPendingState();
  }
};

export const recordPendingTx = (entry: PendingExecutionTx, baseDir = process.cwd()): void => {
  const state = readPendingState(baseDir);
  const existingIdx = state.pending.findIndex((candidate) => candidate.txHash === entry.txHash);
  if (existingIdx >= 0) {
    state.pending[existingIdx] = entry;
  } else {
    state.pending.push(entry);
  }
  state.updatedAt = new Date().toISOString();
  writePendingState(state, baseDir);
};

export const clearPendingTx = (txHash: string, baseDir = process.cwd()): void => {
  const state = readPendingState(baseDir);
  state.pending = state.pending.filter((entry) => entry.txHash.toLowerCase() !== txHash.toLowerCase());
  state.updatedAt = new Date().toISOString();
  writePendingState(state, baseDir);
};

export const checkForStuckPendingTransactions = async (
  input: {
    providersByChain: Record<number, RpcProviderClient>;
    pendingTimeoutSeconds: number;
    killSwitchFile: string;
    nowMs?: number;
    baseDir?: string;
  },
): Promise<StuckTxCheckResult> => {
  const baseDir = input.baseDir ?? process.cwd();
  const nowMs = input.nowMs ?? Date.now();
  const timeoutMs = Math.max(1, input.pendingTimeoutSeconds) * 1000;
  const state = readPendingState(baseDir);
  const nextPending: PendingExecutionTx[] = [];
  const stuck: PendingExecutionTx[] = [];

  for (const pendingTx of state.pending) {
    const provider = input.providersByChain[pendingTx.chainId];
    if (provider && typeof provider.getTransactionReceipt === "function") {
      try {
        const receipt = await provider.getTransactionReceipt(pendingTx.txHash);
        if (receipt) {
          continue;
        }
      } catch {
        // Keep pending if receipt lookup fails.
      }
    }

    const isOverdue = nowMs - pendingTx.sentAtMs >= timeoutMs;
    const alreadyAlerted =
      typeof pendingTx.stuckAlertedAtMs === "number" &&
      Number.isFinite(pendingTx.stuckAlertedAtMs) &&
      pendingTx.stuckAlertedAtMs > 0;
    if (isOverdue && !alreadyAlerted) {
      const updated = {
        ...pendingTx,
        stuckAlertedAtMs: nowMs,
      };
      stuck.push(updated);
      nextPending.push(updated);
      continue;
    }

    nextPending.push(pendingTx);
  }

  const triggered = stuck.length > 0;
  if (triggered && !isKillSwitchActive(input.killSwitchFile)) {
    createKillSwitch(input.killSwitchFile);
  }

  writePendingState(
    {
      updatedAt: new Date(nowMs).toISOString(),
      pending: nextPending,
    },
    baseDir,
  );

  const oldestSentAt = nextPending.reduce((oldest, entry) => Math.min(oldest, entry.sentAtMs), Number.POSITIVE_INFINITY);
  const oldestPendingAgeSeconds =
    Number.isFinite(oldestSentAt) && oldestSentAt > 0 ? Math.max(0, Math.floor((nowMs - oldestSentAt) / 1000)) : 0;

  return {
    triggered,
    stuck,
    pendingCount: nextPending.length,
    oldestPendingAgeSeconds,
  };
};

export const pendingStatePath = (baseDir = process.cwd()): string => resolvePendingPath(baseDir);
