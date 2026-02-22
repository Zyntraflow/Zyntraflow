import { exec } from "child_process";
import dotenv from "dotenv";
import { existsSync } from "fs";
import path from "path";
import { promisify } from "util";
import { parseCliArgs } from "../cli/args";
import { logger } from "../logger";
import { buildStatusSnapshot } from "../reporting/statusSnapshot";
import { getHealth, markTickFailure, markTickStart, markTickSuccess, setWatchdogState } from "./health";
import { writeReadiness } from "./readiness";
import { OperatorWatchdog } from "./watchdog";

dotenv.config({ path: ".env.operator", override: false, quiet: true });
dotenv.config({ path: ".env", override: false, quiet: true });

const execAsync = promisify(exec);
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm" : "npm";

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value || value.trim() === "") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const parseNonNegativeInt = (value: string | undefined, fallback: number): number => {
  if (!value || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
};

const delay = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const extractReportHash = (output: string): string | undefined => {
  const jsonMatch = output.match(/"reportHash"\s*:\s*"(0x[a-fA-F0-9]{64})"/);
  if (jsonMatch?.[1]) {
    return jsonMatch[1];
  }

  const textMatch = output.match(/reportHash\s+(0x[a-fA-F0-9]{64})/i);
  return textMatch?.[1];
};

const extractChainId = (output: string): number | undefined => {
  const jsonMatch = output.match(/"chainId"\s*:\s*(\d+)/);
  if (jsonMatch?.[1]) {
    return Number(jsonMatch[1]);
  }
  return undefined;
};

const extractProfileId = (output: string): string | undefined => {
  const textMatch = output.match(/Using scan profile:\s*([a-zA-Z0-9_-]+)/);
  if (textMatch?.[1]) {
    return textMatch[1];
  }
  const jsonMatch = output.match(/"profile"\s*:\s*\{\s*"id"\s*:\s*"([a-zA-Z0-9_-]+)"/);
  return jsonMatch?.[1];
};

const extractChainsScanned = (output: string): number | undefined => {
  const textMatch = output.match(/Chains scanned:\s*(\d+)/i);
  if (textMatch?.[1]) {
    return Number(textMatch[1]);
  }

  const jsonMatch = output.match(/"chainIds"\s*:\s*\[([^\]]*)\]/);
  if (!jsonMatch?.[1]) {
    return undefined;
  }
  const values = jsonMatch[1]
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  return values.length > 0 ? values.length : undefined;
};

const extractAlertsSent = (output: string): number => {
  const lineMatch = output.match(/Alerts sent:\s*(\d+)/i);
  if (lineMatch?.[1]) {
    return Number(lineMatch[1]);
  }

  const jsonMatch = output.match(/"alertsSent"\s*:\s*(\d+)/);
  if (jsonMatch?.[1]) {
    return Number(jsonMatch[1]);
  }

  return 0;
};

const extractChannelStatus = (
  output: string,
  channel: "Discord" | "Telegram",
): "sent" | "skipped" | "error" | null => {
  const match = output.match(new RegExp(`${channel}\\s+status:\\s*(sent|skipped|error)`, "i"));
  if (!match?.[1]) {
    return null;
  }
  const normalized = match[1].toLowerCase();
  if (normalized === "sent" || normalized === "skipped" || normalized === "error") {
    return normalized;
  }
  return null;
};

const extractChannelSentAt = (output: string, channel: "Discord" | "Telegram"): string | null => {
  const match = output.match(new RegExp(`${channel}\\s+sent\\s+at:\\s*([^\\r\\n]+)`, "i"));
  if (!match?.[1]) {
    return null;
  }
  const value = match[1].trim();
  if (value.toLowerCase() === "none") {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
};

const extractExecutionStatus = (
  output: string,
): "disabled" | "blocked" | "sim_failed" | "sent" | "error" | null => {
  const match = output.match(/Execution status:\s*(disabled|blocked|sim_failed|sent|error)/i);
  if (!match?.[1]) {
    return null;
  }
  const normalized = match[1].toLowerCase();
  if (
    normalized === "disabled" ||
    normalized === "blocked" ||
    normalized === "sim_failed" ||
    normalized === "sent" ||
    normalized === "error"
  ) {
    return normalized;
  }
  return null;
};

const extractExecutionReason = (output: string): string | null => {
  const match = output.match(/Execution reason:\s*([^\r\n]+)/i);
  if (!match?.[1]) {
    return null;
  }
  const reason = match[1].trim();
  return reason.toLowerCase() === "none" ? null : reason;
};

const extractExecutionTxHash = (output: string): string | null => {
  const match = output.match(/Execution tx hash:\s*([^\r\n]+)/i);
  if (!match?.[1]) {
    return null;
  }
  const txHash = match[1].trim();
  if (txHash.toLowerCase() === "none") {
    return null;
  }
  return /^0x[a-fA-F0-9]{64}$/.test(txHash) ? txHash : null;
};

const extractExecutionLastTradeAt = (output: string): string | null => {
  const match = output.match(/Execution last trade at:\s*([^\r\n]+)/i);
  if (!match?.[1]) {
    return null;
  }
  const value = match[1].trim();
  if (value.toLowerCase() === "none") {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
};

const parseChainIdFromEnv = (): number => {
  const raw = process.env.CHAIN_ID?.trim() || process.env.ACCESS_PASS_CHAIN_ID?.trim();
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
};

const WATCHDOG_FAILURE_THRESHOLD = 3;
const WATCHDOG_MAX_BACKOFF_MS = 5 * 60 * 1000;

const readPremiumModeCapable = (): boolean => {
  const envName = ["PREMIUM", "SIGNER", "PRIVATE", "KEY"].join("_");
  const raw = process.env[envName];
  return Boolean(raw && raw.trim() !== "");
};

const sanitizeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/v2\/)([^/\s?#]+)/gi, "$1[REDACTED]")
    .replace(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, "[REDACTED_HEX_64]");
};

type TickOptions = {
  profileId?: string;
  chains?: number[];
  pairs?: string[];
};

const buildTickCommand = (options?: TickOptions): string => {
  const distIndexPath = path.join(process.cwd(), "dist", "index.js");
  const useCompiledRuntime = runtimeIsProduction() && existsSync(distIndexPath);
  const baseCommand = useCompiledRuntime
    ? "node dist/index.js --operator true"
    : `${npmCommand} run dev -- --operator true`;

  const parts = [baseCommand];
  if (options?.profileId) {
    parts.push(`--profile ${options.profileId}`);
  }
  if (options?.chains && options.chains.length > 0) {
    parts.push(`--chains ${options.chains.join(",")}`);
  }
  if (options?.pairs && options.pairs.length > 0) {
    parts.push(`--pairs ${options.pairs.join(",")}`);
  }
  return parts.join(" ");
};

const runtimeIsProduction = (): boolean =>
  (process.env.NODE_ENV || "").trim().toLowerCase() === "production";

export const runOnce = async (options?: TickOptions): Promise<boolean> => {
  markTickStart();

  try {
    const { stdout } = await execAsync(buildTickCommand(options), {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
      shell: isWindows ? process.env.ComSpec ?? "cmd.exe" : "/bin/sh",
    });

    const reportHash = extractReportHash(stdout ?? "");
    const alertsSent = extractAlertsSent(stdout ?? "");
    const discordStatus = extractChannelStatus(stdout ?? "", "Discord");
    const discordSentAt = extractChannelSentAt(stdout ?? "", "Discord");
    const telegramStatus = extractChannelStatus(stdout ?? "", "Telegram");
    const telegramSentAt = extractChannelSentAt(stdout ?? "", "Telegram");
    const executionStatus = extractExecutionStatus(stdout ?? "");
    const executionReason = extractExecutionReason(stdout ?? "");
    const executionTxHash = extractExecutionTxHash(stdout ?? "");
    const executionLastTradeAt = extractExecutionLastTradeAt(stdout ?? "");
    const profileId = extractProfileId(stdout ?? "") ?? options?.profileId ?? "unknown";
    const chainsScanned = extractChainsScanned(stdout ?? "") ?? options?.chains?.length ?? 1;
    const chainId = extractChainId(stdout ?? "") ?? parseChainIdFromEnv();
    markTickSuccess(reportHash, {
      lastAlertsSent: alertsSent,
      lastDiscordStatus: discordStatus,
      lastDiscordSentAt: discordSentAt,
      lastTelegramStatus: telegramStatus,
      lastTelegramSentAt: telegramSentAt,
      executionEnabled: parseBoolean(process.env.EXECUTION_ENABLED, false),
      lastExecutionStatus: executionStatus,
      lastExecutionReason: executionReason,
      lastTradeAt: executionLastTradeAt,
      lastTxHash: executionTxHash,
    });
    writeReadiness({
      lastTickOk: true,
      lastReportHash: reportHash ?? null,
      chainsScanned,
      profileId,
    });
    const health = getHealth();
    const statusSnapshot = buildStatusSnapshot({
      chainId,
      targetNetwork: process.env.TARGET_NETWORK?.trim() || "unknown",
      operatorEnabled: true,
      lastTickOk: health.lastTickOk,
      lastReportHash: health.lastReportHash,
      consecutiveFailures: health.consecutiveFailures,
      lastBackoffMs: health.lastBackoffMs,
      lastRestartAt: health.lastRestartAt,
      lastAlertsSent: health.lastAlertsSent,
      lastDiscordSentAt: health.lastDiscordSentAt,
      lastDiscordStatus: health.lastDiscordStatus,
      lastTelegramSentAt: health.lastTelegramSentAt,
      lastTelegramStatus: health.lastTelegramStatus,
      executionEnabled: parseBoolean(process.env.EXECUTION_ENABLED, false),
      lastExecutionStatus: health.lastExecutionStatus,
      lastExecutionReason: health.lastExecutionReason,
      lastTradeAt: health.lastTradeAt,
      lastTxHash: health.lastTxHash,
      premiumModeCapable: readPremiumModeCapable(),
    });
    process.stdout.write("Operator tick ok\n");
    logger.info({ reportHash, statusSnapshot }, "Operator tick ok");
    return true;
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    markTickFailure(message);
    writeReadiness({
      lastTickOk: false,
      chainsScanned: options?.chains?.length ?? 0,
      profileId: options?.profileId ?? "unknown",
    });
    const health = getHealth();
    const statusSnapshot = buildStatusSnapshot({
      chainId: parseChainIdFromEnv(),
      targetNetwork: process.env.TARGET_NETWORK?.trim() || "unknown",
      operatorEnabled: true,
      lastTickOk: health.lastTickOk,
      lastReportHash: health.lastReportHash,
      consecutiveFailures: health.consecutiveFailures,
      lastBackoffMs: health.lastBackoffMs,
      lastRestartAt: health.lastRestartAt,
      lastAlertsSent: health.lastAlertsSent,
      lastDiscordSentAt: health.lastDiscordSentAt,
      lastDiscordStatus: health.lastDiscordStatus,
      lastTelegramSentAt: health.lastTelegramSentAt,
      lastTelegramStatus: health.lastTelegramStatus,
      executionEnabled: parseBoolean(process.env.EXECUTION_ENABLED, false),
      lastExecutionStatus: health.lastExecutionStatus,
      lastExecutionReason: health.lastExecutionReason,
      lastTradeAt: health.lastTradeAt,
      lastTxHash: health.lastTxHash,
      premiumModeCapable: readPremiumModeCapable(),
    });
    logger.error({ error: message, statusSnapshot }, "Operator tick failed");
    return false;
  }
};

export const runLoop = async (
  intervalSeconds: number,
  maxTicks = 0,
  jitterMs = 0,
  shouldContinue: () => boolean = () => true,
  tickOptions?: TickOptions,
): Promise<void> => {
  const watchdog = new OperatorWatchdog({
    failureThreshold: WATCHDOG_FAILURE_THRESHOLD,
    baseBackoffMs: Math.max(1000, intervalSeconds * 1000),
    maxBackoffMs: WATCHDOG_MAX_BACKOFF_MS,
    closeProviders: async () => {
      // Each tick runs in an isolated subprocess. Recovery still performs an explicit cleanup hook.
      logger.warn("Watchdog restart: resetting operator resources");
    },
  });

  let ticks = 0;
  while (shouldContinue()) {
    const succeeded = await runOnce(tickOptions);
    ticks += 1;

    if (succeeded) {
      const snapshot = watchdog.recordSuccess();
      setWatchdogState(snapshot);
      writeReadiness(snapshot);
    } else {
      const result = await watchdog.recordFailureAndRecover();
      setWatchdogState(result.snapshot);
      writeReadiness(result.snapshot);
      if (result.restarted) {
        logger.warn(
          {
            consecutiveFailures: result.snapshot.consecutiveFailures,
            lastBackoffMs: result.snapshot.lastBackoffMs,
            lastRestartAt: result.snapshot.lastRestartAt,
          },
          "Watchdog triggered controlled restart",
        );
      }
    }

    if (maxTicks > 0 && ticks >= maxTicks) {
      return;
    }

    if (!succeeded) {
      continue;
    }

    const baseDelay = intervalSeconds * 1000;
    const jitterDelay = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
    await delay(baseDelay + jitterDelay);
  }
};

const main = async (): Promise<void> => {
  const cliArgs = parseCliArgs();
  const operatorEnabled = cliArgs.operatorOverride ?? parseBoolean(process.env.OPERATOR_ENABLE, true);
  const intervalSeconds = cliArgs.intervalOverride ?? parsePositiveInt(process.env.OPERATOR_INTERVAL_SECONDS, 30);
  const maxTicks = parseNonNegativeInt(process.env.OPERATOR_MAX_TICKS, 0);
  const jitterMs = parseNonNegativeInt(process.env.OPERATOR_JITTER_MS, 500);

  if (!operatorEnabled) {
    logger.info("Operator disabled");
    return;
  }

  let shuttingDown = false;
  const requestShutdown = (signal: "SIGINT" | "SIGTERM"): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Operator shutdown requested");
  };

  process.on("SIGINT", () => requestShutdown("SIGINT"));
  process.on("SIGTERM", () => requestShutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ error: sanitizeErrorMessage(reason) }, "Unhandled rejection");
  });
  process.on("uncaughtException", (error) => {
    logger.error({ error: sanitizeErrorMessage(error) }, "Uncaught exception");
  });

  try {
    logger.info({ intervalSeconds, maxTicks, jitterMs }, "Operator loop started");
    process.stdout.write(`Operator loop started (interval=${intervalSeconds}s)\n`);
    await runLoop(
      Math.max(10, intervalSeconds),
      maxTicks,
      jitterMs,
      () => !shuttingDown,
      {
        profileId: cliArgs.profileId,
        chains: cliArgs.chains,
        pairs: cliArgs.pairs,
      },
    );
  } finally {
    logger.info("Operator shutdown clean");
    process.stdout.write("Operator shutdown clean\n");
  }
};

if (require.main === module) {
  void main();
}
