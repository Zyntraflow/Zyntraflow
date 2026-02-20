import { retry, withTimeout } from "../rpc/safeCall";
import type { AlertEvent } from "./alertEngine";

export type AlertWebhookPayload = {
  ts: string;
  reportHash: string;
  pair: string;
  netProfitEth: number;
  slippagePercent: number;
  mode: "free" | "premium";
  signedFreeSummaryUrl: string;
  premiumPackageUrl?: string;
};

export type SendWebhookOptions = {
  timeoutMs?: number;
  retryMax?: number;
  retryBackoffMs?: number;
};

export type WebhookDispatchResult = {
  sent: number;
  failed: number;
  errors: string[];
};

const sanitizeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/\b0x[a-fA-F0-9]{130}\b/g, "[REDACTED_SIGNATURE]")
    .replace(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, "[REDACTED_HEX_64]");
};

const ensureHttpsUrl = (url: string): URL => {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS.");
  }
  return parsed;
};

const toPayload = (event: AlertEvent): AlertWebhookPayload => ({
  ts: event.ts,
  reportHash: event.reportHash,
  pair: event.pair,
  netProfitEth: event.netProfitEth,
  slippagePercent: event.slippagePercent,
  mode: event.mode,
  signedFreeSummaryUrl: event.signedFreeSummaryUrl,
  premiumPackageUrl: event.premiumPackageUrl,
});

export const sendWebhookAlert = async (
  webhookUrl: string,
  payload: AlertWebhookPayload,
  options?: SendWebhookOptions,
): Promise<void> => {
  const parsed = ensureHttpsUrl(webhookUrl);
  const timeoutMs = options?.timeoutMs ?? 5000;
  const retryMax = options?.retryMax ?? 2;
  const retryBackoffMs = options?.retryBackoffMs ?? 250;

  await retry(
    async () =>
      withTimeout(
        (async () => {
          const response = await fetch(parsed.toString(), {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error(`Webhook responded with status ${response.status}`);
          }
        })(),
        timeoutMs,
        "Webhook delivery timed out",
      ),
    {
      max: retryMax,
      backoffMs: retryBackoffMs,
      jitterMs: 100,
    },
  );
};

export const dispatchWebhookAlerts = async (
  events: AlertEvent[],
  options?: SendWebhookOptions,
): Promise<WebhookDispatchResult> => {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const event of events) {
    if (!event.webhookUrl) {
      continue;
    }

    try {
      await sendWebhookAlert(event.webhookUrl, toPayload(event), options);
      sent += 1;
    } catch (error) {
      failed += 1;
      errors.push(`webhook ${event.userAddress}: ${sanitizeError(error)}`);
    }
  }

  return { sent, failed, errors };
};
