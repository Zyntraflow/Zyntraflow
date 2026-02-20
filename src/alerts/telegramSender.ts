import { promises as fs } from "fs";
import path from "path";
import { retry, withTimeout } from "../rpc/safeCall";
import type { AlertEvent } from "./alertEngine";
import type { AlertChannelStatus } from "./discordSender";

export type TelegramSendResult = {
  status: AlertChannelStatus;
  sentAt: string | null;
  reason?: string;
  error?: string;
};

export type TelegramSenderInput = {
  event: AlertEvent | null;
  enabled: boolean;
  botToken?: string;
  chatId?: string;
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
const RATE_LIMIT_FILE = "telegram-rate-limit.json";

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

const buildTelegramText = (event: AlertEvent): string => {
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

export const sendTelegramAlert = async (input: TelegramSenderInput): Promise<TelegramSendResult> => {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();

  if (!input.enabled) {
    return { status: "skipped", sentAt: null, reason: "disabled" };
  }

  if (!input.event) {
    return { status: "skipped", sentAt: null, reason: "no_alert" };
  }

  if (!input.botToken || !input.chatId) {
    return { status: "error", sentAt: null, error: "Missing Telegram bot configuration." };
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
  const endpoint = `https://api.telegram.org/bot${input.botToken}/sendMessage`;

  try {
    await retry(
      async () =>
        withTimeout(
          (async () => {
            const response = await fetchFn(endpoint, {
              method: "POST",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                chat_id: input.chatId,
                text: buildTelegramText(input.event!),
                disable_web_page_preview: true,
              }),
            });
            if (!response.ok) {
              const raw = await response.text().catch(() => "");
              throw new Error(`Telegram API ${response.status}: ${sanitizeMessage(raw.slice(0, 200))}`);
            }
          })(),
          timeoutMs,
          "Telegram alert send timed out",
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
