import fs from "fs";
import path from "path";
import type { ExecutionConfig } from "../config";
import type { ExecutionSendResult } from "./types";
import { isKillSwitchActive } from "./killSwitch";
import { readExecutionPolicyState } from "./policy";
import { readPendingState } from "./stuckTxGuard";

export type ExecutionStatusSnapshot = {
  enabled: boolean;
  approvalsEnabled: boolean;
  approvalsMaxAmount: number;
  maxTradeEth: number;
  maxGasGwei: number;
  maxSlippageBps: number;
  minNetProfitEth: number;
  dailyLossLimitEth: number;
  dailyLossEth: number;
  dailyLossRemainingEth: number;
  cooldownSeconds: number;
  replayWindowSeconds: number;
  pendingTimeoutMinutes: number;
  pendingTxCount: number;
  killSwitchActive: boolean;
  lastTradeAt: string | null;
  lastTxHash: string | null;
  lastExecutionStatus: ExecutionSendResult["status"];
  lastExecutionReason: string | null;
};

const STATUS_FILE = path.join("public-feed", "execution-status.json");

const resolveStatusPath = (baseDir = process.cwd()): string => path.join(baseDir, STATUS_FILE);

export const buildExecutionStatusSnapshot = (
  config: ExecutionConfig,
  executionResult: ExecutionSendResult,
  baseDir = process.cwd(),
): ExecutionStatusSnapshot => {
  const state = readExecutionPolicyState(baseDir);
  const pending = readPendingState(baseDir);
  const dailyLossRemainingEth = Math.max(0, config.DAILY_LOSS_LIMIT_ETH - state.dailyLossEth);
  return {
    enabled: config.ENABLED,
    approvalsEnabled: config.APPROVALS_ENABLED,
    approvalsMaxAmount: config.APPROVALS_MAX_AMOUNT,
    maxTradeEth: config.MAX_TRADE_ETH,
    maxGasGwei: config.MAX_GAS_GWEI,
    maxSlippageBps: config.MAX_SLIPPAGE_BPS,
    minNetProfitEth: config.MIN_NET_PROFIT_ETH,
    dailyLossLimitEth: config.DAILY_LOSS_LIMIT_ETH,
    dailyLossEth: state.dailyLossEth,
    dailyLossRemainingEth,
    cooldownSeconds: config.COOLDOWN_SECONDS,
    replayWindowSeconds: config.REPLAY_WINDOW_SECONDS,
    pendingTimeoutMinutes: config.PENDING_TIMEOUT_MINUTES,
    pendingTxCount: pending.pending.length,
    killSwitchActive: isKillSwitchActive(config.KILL_SWITCH_FILE),
    lastTradeAt: executionResult.lastTradeAt ?? state.lastTradeAt,
    lastTxHash: executionResult.txHash ?? state.lastTxHash,
    lastExecutionStatus: executionResult.status,
    lastExecutionReason: executionResult.reason ?? null,
  };
};

export const writeExecutionStatusSnapshot = (snapshot: ExecutionStatusSnapshot, baseDir = process.cwd()): string => {
  const statusPath = resolveStatusPath(baseDir);
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(statusPath, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8" });

  const webPublicDir = path.join(baseDir, "my-smart-wallets-app", "public", "public-feed");
  if (fs.existsSync(path.join(baseDir, "my-smart-wallets-app", "public"))) {
    fs.mkdirSync(webPublicDir, { recursive: true });
    fs.writeFileSync(path.join(webPublicDir, "execution-status.json"), `${JSON.stringify(snapshot, null, 2)}\n`, {
      encoding: "utf8",
    });
  }

  return statusPath;
};
