import { APP_VERSION } from "../version";

export type StatusSnapshot = {
  ts: string;
  chainId: number;
  targetNetwork: string;
  operatorEnabled: boolean;
  lastTickOk: boolean;
  lastReportHash: string | null;
  consecutiveFailures: number;
  lastBackoffMs: number;
  lastRestartAt: string | null;
  lastAlertsSent: number;
  lastDiscordSentAt: string | null;
  lastDiscordStatus: "sent" | "skipped" | "error" | null;
  lastTelegramSentAt: string | null;
  lastTelegramStatus: "sent" | "skipped" | "error" | null;
  premiumModeCapable: boolean;
  version: string;
};

export type StatusSnapshotInput = {
  chainId: number;
  targetNetwork: string;
  operatorEnabled: boolean;
  lastTickOk: boolean;
  lastReportHash?: string | null;
  consecutiveFailures?: number;
  lastBackoffMs?: number;
  lastRestartAt?: string | null;
  lastAlertsSent?: number;
  lastDiscordSentAt?: string | null;
  lastDiscordStatus?: "sent" | "skipped" | "error" | null;
  lastTelegramSentAt?: string | null;
  lastTelegramStatus?: "sent" | "skipped" | "error" | null;
  premiumModeCapable: boolean;
};

export const buildStatusSnapshot = (input: StatusSnapshotInput): StatusSnapshot => {
  return {
    ts: new Date().toISOString(),
    chainId: input.chainId,
    targetNetwork: input.targetNetwork,
    operatorEnabled: input.operatorEnabled,
    lastTickOk: input.lastTickOk,
    lastReportHash: input.lastReportHash ?? null,
    consecutiveFailures: input.consecutiveFailures ?? 0,
    lastBackoffMs: input.lastBackoffMs ?? 0,
    lastRestartAt: input.lastRestartAt ?? null,
    lastAlertsSent: input.lastAlertsSent ?? 0,
    lastDiscordSentAt: input.lastDiscordSentAt ?? null,
    lastDiscordStatus: input.lastDiscordStatus ?? null,
    lastTelegramSentAt: input.lastTelegramSentAt ?? null,
    lastTelegramStatus: input.lastTelegramStatus ?? null,
    premiumModeCapable: input.premiumModeCapable,
    version: APP_VERSION,
  };
};
