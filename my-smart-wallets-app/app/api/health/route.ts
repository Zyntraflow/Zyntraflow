import { promises as fs } from "fs";
import path from "path";
import { incrementMetricCounter } from "@/lib/metricsStore";

type OperatorHealth = {
  timestamp: string;
  lastTickAt: string | null;
  lastTickOk: boolean;
  lastError: string | null;
  lastReportHash: string | null;
  consecutiveFailures: number;
  lastBackoffMs: number;
  lastRestartAt: string | null;
  lastAlertsSent: number;
  lastDiscordSentAt: string | null;
  lastDiscordStatus: "sent" | "skipped" | "error" | null;
  lastTelegramSentAt: string | null;
  lastTelegramStatus: "sent" | "skipped" | "error" | null;
  executionEnabled: boolean;
  lastExecutionStatus: "disabled" | "blocked" | "sim_failed" | "sent" | "error" | null;
  lastExecutionReason: string | null;
  lastTradeAt: string | null;
  lastTxHash: string | null;
};

type ExecutionPublicStatus = {
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
  pendingTimeoutSeconds: number;
  pendingTxCount: number;
  pendingTxAgeSeconds: number;
  killSwitchActive: boolean;
  lastTradeAt: string | null;
  lastTxHash: string | null;
  lastExecutionStatus: "disabled" | "blocked" | "sim_failed" | "sent" | "error";
  lastExecutionReason: string | null;
};

const defaultHealth = (): OperatorHealth => ({
  timestamp: new Date().toISOString(),
  lastTickAt: null,
  lastTickOk: false,
  lastError: null,
  lastReportHash: null,
  consecutiveFailures: 0,
  lastBackoffMs: 0,
  lastRestartAt: null,
  lastAlertsSent: 0,
  lastDiscordSentAt: null,
  lastDiscordStatus: null,
  lastTelegramSentAt: null,
  lastTelegramStatus: null,
  executionEnabled: false,
  lastExecutionStatus: null,
  lastExecutionReason: null,
  lastTradeAt: null,
  lastTxHash: null,
});

const defaultExecutionStatus = (): ExecutionPublicStatus => ({
  enabled: false,
  approvalsEnabled: false,
  approvalsMaxAmount: 0,
  maxTradeEth: 0,
  maxGasGwei: 0,
  maxSlippageBps: 0,
  minNetProfitEth: 0,
  dailyLossLimitEth: 0,
  dailyLossEth: 0,
  dailyLossRemainingEth: 0,
  cooldownSeconds: 0,
  replayWindowSeconds: 0,
  pendingTimeoutSeconds: 0,
  pendingTxCount: 0,
  pendingTxAgeSeconds: 0,
  killSwitchActive: false,
  lastTradeAt: null,
  lastTxHash: null,
  lastExecutionStatus: "disabled",
  lastExecutionReason: null,
});

export async function GET(): Promise<Response> {
  try {
    await incrementMetricCounter("healthHits");
  } catch {
    // Metrics are best-effort and must not block health responses.
  }

  const healthPath = path.join(process.cwd(), "public", "public-feed", "operator-health.json");
  const executionStatusPath = path.join(process.cwd(), "public", "public-feed", "execution-status.json");

  let health = defaultHealth();
  try {
    const raw = await fs.readFile(healthPath, "utf8");
    health = {
      ...health,
      ...(JSON.parse(raw) as Partial<OperatorHealth>),
    };
  } catch {
    // Default health for web-only mode.
  }

  let executionStatus = defaultExecutionStatus();
  try {
    const raw = await fs.readFile(executionStatusPath, "utf8");
    executionStatus = {
      ...executionStatus,
      ...(JSON.parse(raw) as Partial<ExecutionPublicStatus>),
    };
  } catch {
    // Keep default execution status when execution artifact is not present.
  }

  return Response.json(
    {
      ok: true,
      timestamp: new Date().toISOString(),
      lastTickAt: health.lastTickAt,
      lastTickOk: health.lastTickOk,
      lastReportHash: health.lastReportHash,
      lastError: health.lastError,
      consecutiveFailures: health.consecutiveFailures,
      lastBackoffMs: health.lastBackoffMs,
      lastRestartAt: health.lastRestartAt,
      lastAlertsSent: health.lastAlertsSent,
      lastDiscordSentAt: health.lastDiscordSentAt,
      lastDiscordStatus: health.lastDiscordStatus,
      lastTelegramSentAt: health.lastTelegramSentAt,
      lastTelegramStatus: health.lastTelegramStatus,
      executionEnabled: executionStatus.enabled || health.executionEnabled,
      lastExecutionStatus: executionStatus.lastExecutionStatus ?? health.lastExecutionStatus,
      lastExecutionReason: executionStatus.lastExecutionReason ?? health.lastExecutionReason,
      lastTradeAt: executionStatus.lastTradeAt ?? health.lastTradeAt,
      lastExecutionAt: executionStatus.lastTradeAt ?? health.lastTradeAt,
      lastTxHash: executionStatus.lastTxHash ?? health.lastTxHash,
      killSwitchPresent: executionStatus.killSwitchActive,
      pendingTxAgeSeconds: executionStatus.pendingTxAgeSeconds,
      executionCaps: {
        approvalsEnabled: executionStatus.approvalsEnabled,
        approvalsMaxAmount: executionStatus.approvalsMaxAmount,
        maxTradeEth: executionStatus.maxTradeEth,
        maxGasGwei: executionStatus.maxGasGwei,
        maxSlippageBps: executionStatus.maxSlippageBps,
        minNetProfitEth: executionStatus.minNetProfitEth,
        dailyLossLimitEth: executionStatus.dailyLossLimitEth,
        cooldownSeconds: executionStatus.cooldownSeconds,
        replayWindowSeconds: executionStatus.replayWindowSeconds,
        pendingTimeoutSeconds: executionStatus.pendingTimeoutSeconds,
      },
      executionState: {
        dailyLossEth: executionStatus.dailyLossEth,
        dailyLossRemainingEth: executionStatus.dailyLossRemainingEth,
        pendingTxCount: executionStatus.pendingTxCount,
        pendingTxAgeSeconds: executionStatus.pendingTxAgeSeconds,
        killSwitchActive: executionStatus.killSwitchActive,
      },
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
