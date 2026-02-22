import fs from "fs";
import path from "path";
import type { ExecutionConfig } from "../config";
import { isKillSwitchActive } from "./killSwitch";
import type { ExecutionDecision, ExecutionPlan, ExecutionPolicyState } from "./types";

const STATE_DIR = path.join("reports", "execution");
const STATE_FILE = path.join(STATE_DIR, "state.json");

const sanitizeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
};

const defaultState = (now = new Date()): ExecutionPolicyState => ({
  date: now.toISOString().slice(0, 10),
  dailyPnlEth: 0,
  dailyLossEth: 0,
  lastTradeAt: null,
  lastTxHash: null,
  consecutiveFailures: 0,
});

const resolveStatePath = (baseDir = process.cwd()): string => {
  return path.join(baseDir, STATE_FILE);
};

const writeStateAtomic = (state: ExecutionPolicyState, baseDir = process.cwd()): void => {
  const filePath = resolveStatePath(baseDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8" });
  fs.renameSync(tempPath, filePath);
};

const normalizeStateDate = (state: ExecutionPolicyState, now = new Date()): ExecutionPolicyState => {
  const currentDate = now.toISOString().slice(0, 10);
  if (state.date === currentDate) {
    return state;
  }

  return {
    ...defaultState(now),
    lastTradeAt: state.lastTradeAt,
    lastTxHash: state.lastTxHash,
    consecutiveFailures: state.consecutiveFailures,
  };
};

export const readExecutionPolicyState = (baseDir = process.cwd()): ExecutionPolicyState => {
  const filePath = resolveStatePath(baseDir);
  if (!fs.existsSync(filePath)) {
    return defaultState();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<ExecutionPolicyState>;
    const state: ExecutionPolicyState = {
      date: typeof parsed.date === "string" && parsed.date.trim() !== "" ? parsed.date : defaultState().date,
      dailyPnlEth: sanitizeNumber(parsed.dailyPnlEth),
      dailyLossEth: sanitizeNumber(parsed.dailyLossEth),
      lastTradeAt: typeof parsed.lastTradeAt === "string" && parsed.lastTradeAt.trim() !== "" ? parsed.lastTradeAt : null,
      lastTxHash: typeof parsed.lastTxHash === "string" && parsed.lastTxHash.trim() !== "" ? parsed.lastTxHash : null,
      consecutiveFailures: Math.max(0, Math.trunc(sanitizeNumber(parsed.consecutiveFailures))),
    };
    return normalizeStateDate(state);
  } catch {
    return defaultState();
  }
};

export const writeExecutionPolicyState = (state: ExecutionPolicyState, baseDir = process.cwd()): ExecutionPolicyState => {
  const normalized = normalizeStateDate(state);
  writeStateAtomic(normalized, baseDir);
  return normalized;
};

export const updateExecutionPolicyState = (
  updater: (current: ExecutionPolicyState) => ExecutionPolicyState,
  baseDir = process.cwd(),
): ExecutionPolicyState => {
  const current = readExecutionPolicyState(baseDir);
  const updated = normalizeStateDate(updater(current));
  writeStateAtomic(updated, baseDir);
  return updated;
};

const validateCooldown = (
  state: ExecutionPolicyState,
  cooldownSeconds: number,
  nowMs: number,
): ExecutionDecision | null => {
  if (!state.lastTradeAt || cooldownSeconds <= 0) {
    return null;
  }

  const lastTradeMs = Date.parse(state.lastTradeAt);
  if (!Number.isFinite(lastTradeMs)) {
    return null;
  }

  if (nowMs - lastTradeMs < cooldownSeconds * 1000) {
    return { allowed: false, reason: "COOLDOWN_ACTIVE" };
  }

  return null;
};

const validateAllowlist = (
  plan: ExecutionPlan,
  allowlist: string[],
): ExecutionDecision | null => {
  if (allowlist.length === 0) {
    return null;
  }

  const allowed = new Set(allowlist.map((address) => address.toLowerCase()));
  if (!allowed.has(plan.to.toLowerCase())) {
    return { allowed: false, reason: "TO_ADDRESS_NOT_ALLOWLISTED" };
  }

  return null;
};

export const evaluateExecutionPolicy = (
  plan: ExecutionPlan,
  cfg: ExecutionConfig,
  state: ExecutionPolicyState,
  options?: { nowMs?: number },
): ExecutionDecision => {
  const nowMs = options?.nowMs ?? Date.now();

  if (!cfg.ENABLED) {
    return { allowed: false, reason: "EXECUTION_DISABLED" };
  }

  if (isKillSwitchActive(cfg.KILL_SWITCH_FILE)) {
    return { allowed: false, reason: "KILL_SWITCH_ACTIVE" };
  }

  if (plan.chainId !== cfg.CHAIN_ID) {
    return { allowed: false, reason: "CHAIN_NOT_ALLOWED" };
  }

  if (plan.expectedNetProfitEth < cfg.MIN_NET_PROFIT_ETH) {
    return { allowed: false, reason: "NET_PROFIT_BELOW_MINIMUM" };
  }

  if (plan.valueEth > cfg.MAX_TRADE_ETH) {
    return { allowed: false, reason: "MAX_TRADE_EXCEEDED" };
  }

  const candidateGasGwei = plan.gasGwei ?? plan.maxGasGwei;
  if (candidateGasGwei > cfg.MAX_GAS_GWEI) {
    return { allowed: false, reason: "GAS_CAP_EXCEEDED" };
  }

  const candidateSlippageBps = plan.slippageBps ?? plan.maxSlippageBps;
  if (candidateSlippageBps > cfg.MAX_SLIPPAGE_BPS) {
    return { allowed: false, reason: "SLIPPAGE_CAP_EXCEEDED" };
  }

  if (state.dailyLossEth >= cfg.DAILY_LOSS_LIMIT_ETH) {
    return { allowed: false, reason: "DAILY_LOSS_LIMIT_REACHED" };
  }

  const cooldownDecision = validateCooldown(state, cfg.COOLDOWN_SECONDS, nowMs);
  if (cooldownDecision) {
    return cooldownDecision;
  }

  const allowlistDecision = validateAllowlist(plan, cfg.TO_ADDRESS_ALLOWLIST);
  if (allowlistDecision) {
    return allowlistDecision;
  }

  return { allowed: true };
};

export const executionStateFilePath = (baseDir = process.cwd()): string => resolveStatePath(baseDir);
export const executionStateDirPath = (baseDir = process.cwd()): string => path.join(baseDir, STATE_DIR);
