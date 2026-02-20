import fs from "fs";
import path from "path";

export type OperatorHealth = {
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
};

const healthState: OperatorHealth = {
  timestamp: new Date(0).toISOString(),
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
};

const sanitizeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/v2\/)([^/\s?#]+)/gi, "$1[REDACTED]")
    .replace(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, "[REDACTED_HEX_64]");
};

const writeHealthSnapshot = (baseDir: string, payload: OperatorHealth): void => {
  const feedDir = path.join(baseDir, "public-feed");
  const filePath = path.join(feedDir, "operator-health.json");
  fs.mkdirSync(feedDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { encoding: "utf8" });

  const webPublicDir = path.join(baseDir, "my-smart-wallets-app", "public", "public-feed");
  if (fs.existsSync(path.join(baseDir, "my-smart-wallets-app", "public"))) {
    fs.mkdirSync(webPublicDir, { recursive: true });
    fs.writeFileSync(path.join(webPublicDir, "operator-health.json"), JSON.stringify(payload, null, 2), {
      encoding: "utf8",
    });
  }
};

const persist = (baseDir?: string): void => {
  writeHealthSnapshot(baseDir ?? process.cwd(), healthState);
};

export const markTickStart = (baseDir?: string): void => {
  healthState.timestamp = new Date().toISOString();
  healthState.lastTickAt = healthState.timestamp;
  healthState.lastAlertsSent = 0;
  healthState.lastDiscordSentAt = null;
  healthState.lastDiscordStatus = null;
  healthState.lastTelegramSentAt = null;
  healthState.lastTelegramStatus = null;
  persist(baseDir);
};

export const markTickSuccess = (
  reportHash?: string,
  channelState?: {
    lastAlertsSent?: number;
    lastDiscordSentAt?: string | null;
    lastDiscordStatus?: "sent" | "skipped" | "error" | null;
    lastTelegramSentAt?: string | null;
    lastTelegramStatus?: "sent" | "skipped" | "error" | null;
  },
  baseDir?: string,
): void => {
  healthState.timestamp = new Date().toISOString();
  healthState.lastTickAt = healthState.timestamp;
  healthState.lastTickOk = true;
  healthState.lastError = null;
  const nextAlertsSent = channelState?.lastAlertsSent ?? 0;
  healthState.lastAlertsSent = Number.isInteger(nextAlertsSent) && nextAlertsSent >= 0 ? nextAlertsSent : 0;
  healthState.lastDiscordSentAt = channelState?.lastDiscordSentAt ?? null;
  healthState.lastDiscordStatus = channelState?.lastDiscordStatus ?? "skipped";
  healthState.lastTelegramSentAt = channelState?.lastTelegramSentAt ?? null;
  healthState.lastTelegramStatus = channelState?.lastTelegramStatus ?? "skipped";
  if (reportHash) {
    healthState.lastReportHash = reportHash;
  }
  persist(baseDir);
};

export const markTickFailure = (error: unknown, baseDir?: string): void => {
  healthState.timestamp = new Date().toISOString();
  healthState.lastTickAt = healthState.timestamp;
  healthState.lastTickOk = false;
  healthState.lastError = sanitizeError(error);
  persist(baseDir);
};

export const setWatchdogState = (
  input: {
    consecutiveFailures: number;
    lastBackoffMs: number;
    lastRestartAt: string | null;
  },
  baseDir?: string,
): void => {
  healthState.timestamp = new Date().toISOString();
  healthState.consecutiveFailures =
    Number.isInteger(input.consecutiveFailures) && input.consecutiveFailures >= 0 ? input.consecutiveFailures : 0;
  healthState.lastBackoffMs = Number.isInteger(input.lastBackoffMs) && input.lastBackoffMs >= 0 ? input.lastBackoffMs : 0;
  healthState.lastRestartAt = input.lastRestartAt ?? null;
  persist(baseDir);
};

export const getHealth = (): OperatorHealth => ({ ...healthState });
