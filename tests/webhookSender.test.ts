import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchWebhookAlerts, sendWebhookAlert } from "../src/alerts/webhookSender";
import type { AlertEvent } from "../src/alerts/alertEngine";

const originalFetch = globalThis.fetch;

const baseEvent: AlertEvent = {
  ts: new Date().toISOString(),
  userAddress: "0x0000000000000000000000000000000000000001",
  reportHash: "0x" + "a".repeat(64),
  chainId: 8453,
  pair: "WETH/USDC",
  netProfitEth: 0.02,
  gasCostEth: 0.002,
  slippagePercent: 0.01,
  riskFlags: [],
  score: 2,
  mode: "free",
  notes: [],
  signedFreeSummaryUrl: "/api/feed/latest",
  webhookUrl: "https://alerts.example.com/hook",
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("webhookSender", () => {
  it("sends webhook payload for https endpoints", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendWebhookAlert(baseEvent.webhookUrl!, {
      ts: baseEvent.ts,
      reportHash: baseEvent.reportHash,
      pair: baseEvent.pair,
      netProfitEth: baseEvent.netProfitEth,
      slippagePercent: baseEvent.slippagePercent,
      mode: baseEvent.mode,
      signedFreeSummaryUrl: baseEvent.signedFreeSummaryUrl,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects non-https webhook urls", async () => {
    await expect(
      sendWebhookAlert("http://alerts.example.com/hook", {
        ts: baseEvent.ts,
        reportHash: baseEvent.reportHash,
        pair: baseEvent.pair,
        netProfitEth: baseEvent.netProfitEth,
        slippagePercent: baseEvent.slippagePercent,
        mode: baseEvent.mode,
        signedFreeSummaryUrl: baseEvent.signedFreeSummaryUrl,
      }),
    ).rejects.toThrow("Webhook URL must use HTTPS");
  });

  it("collects failures without throwing for dispatch", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await dispatchWebhookAlerts([baseEvent], {
      retryMax: 0,
      retryBackoffMs: 1,
      timeoutMs: 200,
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("status 500");
  });
});
