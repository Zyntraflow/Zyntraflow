import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendDiscordAlert } from "../src/alerts/discordSender";
import type { AlertEvent } from "../src/alerts/alertEngine";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zyntraflow-discord-"));
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
  reportHash: "0x" + "a".repeat(64),
  chainId: 8453,
  pair: "WETH/USDC",
  netProfitEth: 0.0234,
  gasCostEth: 0.0021,
  slippagePercent: 0.014,
  riskFlags: [],
  score: 2.2,
  mode: "premium",
  notes: [],
  signedFreeSummaryUrl: "/api/feed/latest",
};

describe("discordSender", () => {
  it("posts expected payload and headers", async () => {
    const dir = await createTempDir();
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));

    const result = await sendDiscordAlert({
      event: sampleEvent,
      enabled: true,
      botToken: "discord_token",
      channelId: "123456789",
      minIntervalSeconds: 60,
      baseDir: dir,
      fetchFn,
      retryMax: 0,
      timeoutMs: 1000,
    });

    expect(result.status).toBe("sent");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, options] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/channels/123456789/messages");
    expect(options.headers).toMatchObject({
      authorization: "Bot discord_token",
      "content-type": "application/json",
    });
    const body = JSON.parse(String(options.body)) as { content: string };
    expect(body.content).toContain("Zyntraflow Alert (premium)");
    expect(body.content).toContain("https://zyntraflow.org/launch");
    expect(body.content).toContain("https://zyntraflow.org/api/feed/latest");
  });

  it("skips send when rate-limited", async () => {
    const dir = await createTempDir();
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    const now = new Date("2026-02-19T00:00:00.000Z");

    const first = await sendDiscordAlert({
      event: sampleEvent,
      enabled: true,
      botToken: "discord_token",
      channelId: "123456789",
      minIntervalSeconds: 60,
      baseDir: dir,
      now,
      fetchFn,
      retryMax: 0,
    });
    expect(first.status).toBe("sent");

    const second = await sendDiscordAlert({
      event: sampleEvent,
      enabled: true,
      botToken: "discord_token",
      channelId: "123456789",
      minIntervalSeconds: 60,
      baseDir: dir,
      now: new Date("2026-02-19T00:00:30.000Z"),
      fetchFn,
      retryMax: 0,
    });
    expect(second.status).toBe("skipped");
    expect(second.reason).toBe("rate_limited");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
