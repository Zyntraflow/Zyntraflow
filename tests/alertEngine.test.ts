import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildAlertEvents, persistAlerts, readLatestAlerts } from "../src/alerts/alertEngine";
import type { ScanReport } from "../src/scanner/scanEngine";
import type { Subscription } from "../src/subscriptions/types";

const buildScanReport = (): ScanReport => ({
  ts: new Date().toISOString(),
  chainId: 8453,
  rpcEndpoint: "primary",
  pairsScanned: 1,
  opportunities: [],
  simulations: [],
  rankedOpportunities: [
    {
      chainId: 8453,
      pair: "WETH/USDC",
      buyFrom: "onchain_univ3",
      sellTo: "mock",
      grossGap: 0.02,
      quoteInputs: [],
      simulation: {
        grossProfitEth: 0.03,
        netProfitEth: 0.02,
        gasCostEth: 0.002,
        slippagePercent: 0.015,
        passesThreshold: true,
        riskFlags: [],
      },
      score: 2.5,
    },
    {
      chainId: 8453,
      pair: "WETH/DAI",
      buyFrom: "onchain_univ3",
      sellTo: "mock",
      grossGap: 0.01,
      quoteInputs: [],
      simulation: {
        grossProfitEth: 0.02,
        netProfitEth: 0.008,
        gasCostEth: 0.002,
        slippagePercent: 0.01,
        passesThreshold: false,
        riskFlags: ["LOW_NET_MARGIN"],
      },
      score: 1.1,
    },
  ],
  errors: [],
});

const buildSubscription = (overrides?: Partial<Subscription>): Subscription => ({
  version: 1,
  userAddress: "0x0000000000000000000000000000000000000001",
  createdAt: 1_771_520_000,
  minNetProfitEth: 0.001,
  maxSlippagePercent: 0.5,
  chains: [8453],
  pairs: ["WETH/USDC"],
  delivery: {},
  nonce: "nonce_12345678",
  signature: "0x" + "1".repeat(130),
  ...overrides,
});

describe("alertEngine", () => {
  it("clamps free thresholds and emits matching alerts", async () => {
    const scanReport = buildScanReport();
    const subscription = buildSubscription();

    const result = await buildAlertEvents({
      scanReport,
      reportHash: "0x" + "a".repeat(64),
      subscriptions: [subscription],
      isPremiumAddress: async () => false,
      signedFreeSummaryUrl: "/api/feed/latest",
    });

    expect(result.errors).toHaveLength(0);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].mode).toBe("free");
    expect(result.events[0].notes.join(" ")).toContain("clamped");
  });

  it("keeps requested thresholds for premium users", async () => {
    const scanReport = buildScanReport();
    const subscription = buildSubscription({
      userAddress: "0x0000000000000000000000000000000000000002",
      minNetProfitEth: 0.015,
      maxSlippagePercent: 0.02,
      nonce: "nonce_abcdefgh",
      signature: "0x" + "2".repeat(130),
    });

    const result = await buildAlertEvents({
      scanReport,
      reportHash: "0x" + "b".repeat(64),
      subscriptions: [subscription],
      isPremiumAddress: async () => true,
      signedFreeSummaryUrl: "/api/feed/latest",
      premiumPackageUrlByAddress: {
        [subscription.userAddress.toLowerCase()]: "/api/premium/0xhash/0xaddress",
      },
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].mode).toBe("premium");
    expect(result.events[0].notes).toHaveLength(0);
    expect(result.events[0].premiumPackageUrl).toContain("/api/premium/");
  });

  it("persists alert jsonl and latest snapshots", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "zyntraflow-alerts-"));
    const event = {
      ts: new Date().toISOString(),
      userAddress: "0x0000000000000000000000000000000000000003",
      reportHash: "0x" + "c".repeat(64),
      chainId: 8453,
      pair: "WETH/USDC",
      netProfitEth: 0.03,
      gasCostEth: 0.002,
      slippagePercent: 0.01,
      riskFlags: [],
      score: 3.2,
      mode: "premium" as const,
      notes: [],
      signedFreeSummaryUrl: "/api/feed/latest",
      premiumPackageUrl: "/api/premium/hash/address",
      webhookUrl: "https://alerts.example.com/hook",
    };

    const persisted = await persistAlerts([event], { baseDir: tempDir, now: new Date("2026-02-19T00:00:00.000Z") });
    expect(persisted.jsonlPath).toContain(path.join("reports", "alerts"));
    expect(persisted.latestPath).toContain(path.join("reports", "alerts", "latest.json"));

    const latest = await readLatestAlerts({ baseDir: tempDir });
    expect(latest.global).toHaveLength(1);
    expect(latest.byUser[event.userAddress.toLowerCase()]).toHaveLength(1);

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
