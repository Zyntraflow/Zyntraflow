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

export async function GET(): Promise<Response> {
  try {
    await incrementMetricCounter("healthHits");
  } catch {
    // Metrics are best-effort and must not block health responses.
  }

  const healthPath = path.join(process.cwd(), "public", "public-feed", "operator-health.json");

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
      executionEnabled: health.executionEnabled,
      lastExecutionStatus: health.lastExecutionStatus,
      lastExecutionReason: health.lastExecutionReason,
      lastTradeAt: health.lastTradeAt,
      lastTxHash: health.lastTxHash,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
