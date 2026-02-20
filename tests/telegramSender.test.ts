import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTelegramAlert } from "../src/alerts/telegramSender";
import type { AlertEvent } from "../src/alerts/alertEngine";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zyntraflow-telegram-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

const sampleEvent: AlertEvent = {
  ts: new Date().toISOString(),
  userAddress: "0x0000000000000000000000000000000000000001",
  reportHash: "0x" + "b".repeat(64),
  chainId: 42161,
  pair: "WETH/USDC",
  netProfitEth: 0.018,
  gasCostEth: 0.002,
  slippagePercent: 0.01,
  riskFlags: [],
  score: 1.8,
  mode: "free",
  notes: [],
  signedFreeSummaryUrl: "/api/feed/latest",
};

describe("telegramSender", () => {
  it("posts expected payload format", async () => {
    const dir = await createTempDir();
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));

    const result = await sendTelegramAlert({
      event: sampleEvent,
      enabled: true,
      botToken: "telegram_token",
      chatId: "-100123",
      minIntervalSeconds: 60,
      baseDir: dir,
      fetchFn,
      retryMax: 0,
      timeoutMs: 1000,
    });

    expect(result.status).toBe("sent");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, options] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://api.telegram.org/bottelegram_token/sendMessage");
    const body = JSON.parse(String(options.body)) as { chat_id: string; text: string; disable_web_page_preview: boolean };
    expect(body.chat_id).toBe("-100123");
    expect(body.disable_web_page_preview).toBe(true);
    expect(body.text).toContain("Zyntraflow Alert (free)");
    expect(body.text).toContain("https://zyntraflow.org/launch");
  });

  it("skips send when rate-limited", async () => {
    const dir = await createTempDir();
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    const now = new Date("2026-02-19T01:00:00.000Z");

    const first = await sendTelegramAlert({
      event: sampleEvent,
      enabled: true,
      botToken: "telegram_token",
      chatId: "-100123",
      minIntervalSeconds: 60,
      baseDir: dir,
      now,
      fetchFn,
      retryMax: 0,
    });
    expect(first.status).toBe("sent");

    const second = await sendTelegramAlert({
      event: sampleEvent,
      enabled: true,
      botToken: "telegram_token",
      chatId: "-100123",
      minIntervalSeconds: 60,
      baseDir: dir,
      now: new Date("2026-02-19T01:00:20.000Z"),
      fetchFn,
      retryMax: 0,
    });
    expect(second.status).toBe("skipped");
    expect(second.reason).toBe("rate_limited");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
