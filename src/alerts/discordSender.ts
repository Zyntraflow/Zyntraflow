import { promises as fs } from "fs";
import path from "path";
import { retry, withTimeout } from "../rpc/safeCall";
import type { AlertEvent } from "./alertEngine";

export type AlertChannelStatus = "sent" | "skipped" | "error";

export type DiscordSendResult = {
  status: AlertChannelStatus;
  sentAt: string | null;
  reason?: string;
  error?: string;
};

export type DiscordSenderInput = {
  event: AlertEvent | null;
  enabled: boolean;
  botToken?: string;
  channelId?: string;
  minIntervalSeconds: number;
  now?: Date;
  fetchFn?: typeof fetch;
  baseDir?: string;
  timeoutMs?: number;
  retryMax?: number;
  retryBackoffMs?: number;
};

type RateLimitState = {
  lastSentAtMs: number;
};

const ALERTS_DIR = ["reports", "alerts"];
const RATE_LIMIT_FILE = "discord-rate-limit.json";

const sanitizeMessage = (value: string): string =>
  value
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/bot)([^/\s?#]+)/gi, "$1[REDACTED]")
    .replace(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, "[REDACTED_HEX_64]");

const shortenHash = (reportHash: string): string =>
  reportHash.length > 18 ? `${reportHash.slice(0, 10)}...${reportHash.slice(-8)}` : reportHash;

const resolveRateLimitPath = (baseDir: string): string =>
  path.join(baseDir, ...ALERTS_DIR, RATE_LIMIT_FILE);

const readRateLimitState = async (filePath: string): Promise<RateLimitState | null> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<RateLimitState>;
    if (!Number.isFinite(parsed.lastSentAtMs)) {
      return null;
    }
    return {
      lastSentAtMs: Number(parsed.lastSentAtMs),
    };
  } catch {
    return null;
  }
};

const writeRateLimitState = async (filePath: string, state: RateLimitState): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8" });
};

const isRateLimited = (lastSentAtMs: number, nowMs: number, minIntervalSeconds: number): boolean => {
  return nowMs - lastSentAtMs < minIntervalSeconds * 1000;
};

const buildDiscordContent = (event: AlertEvent): string => {
  return [
    `Zyntraflow Alert (${event.mode})`,
    `pair: ${event.pair}`,
    `chainId: ${event.chainId}`,
    `netProfitEth: ${event.netProfitEth.toFixed(6)}`,
    `slippagePercent: ${(event.slippagePercent * 100).toFixed(2)}%`,
    `reportHash: ${shortenHash(event.reportHash)}`,
    "launch: https://zyntraflow.org/launch",
    "feed: https://zyntraflow.org/api/feed/latest",
  ].join("\n");
};

export const sendDiscordAlert = async (input: DiscordSenderInput): Promise<DiscordSendResult> => {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();

  if (!input.enabled) {
    return { status: "skipped", sentAt: null, reason: "disabled" };
  }

  if (!input.event) {
    return { status: "skipped", sentAt: null, reason: "no_alert" };
  }

  if (!input.botToken || !input.channelId) {
    return { status: "error", sentAt: null, error: "Missing Discord bot configuration." };
  }

  const baseDir = input.baseDir ?? process.cwd();
  const rateLimitPath = resolveRateLimitPath(baseDir);
  const state = await readRateLimitState(rateLimitPath);
  if (state && isRateLimited(state.lastSentAtMs, nowMs, input.minIntervalSeconds)) {
    return { status: "skipped", sentAt: null, reason: "rate_limited" };
  }

  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? 8000;
  const retryMax = input.retryMax ?? 2;
  const retryBackoffMs = input.retryBackoffMs ?? 250;
  const endpoint = `https://discord.com/api/v10/channels/${encodeURIComponent(input.channelId)}/messages`;

  try {
    await retry(
      async () =>
        withTimeout(
          (async () => {
            const response = await fetchFn(endpoint, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bot ${input.botToken}`,
              },
              body: JSON.stringify({
                content: buildDiscordContent(input.event!),
                allowed_mentions: {
                  parse: [],
                },
              }),
            });

            if (!response.ok) {
              const raw = await response.text().catch(() => "");
              throw new Error(`Discord API ${response.status}: ${sanitizeMessage(raw.slice(0, 200))}`);
            }
          })(),
          timeoutMs,
          "Discord alert send timed out",
        ),
      {
        max: retryMax,
        backoffMs: retryBackoffMs,
        jitterMs: 100,
      },
    );

    await writeRateLimitState(rateLimitPath, { lastSentAtMs: nowMs });
    return { status: "sent", sentAt: now.toISOString() };
  } catch (error) {
    return {
      status: "error",
      sentAt: null,
      error: sanitizeMessage(error instanceof Error ? error.message : String(error)),
    };
  }
};
