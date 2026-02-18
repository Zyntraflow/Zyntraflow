import { mkdtempSync, rmSync } from "fs";
import path from "path";
import { tmpdir } from "os";
import { describe, expect, it } from "vitest";
import { incrementMetric, readDailyMetrics } from "../src/metrics/metricsStore";

describe("metricsStore", () => {
  it("increments expected counter and persists by day", async () => {
    const baseDir = mkdtempSync(path.join(tmpdir(), "zyntra-metrics-"));
    const now = new Date("2026-02-18T00:00:00.000Z");

    try {
      const first = await incrementMetric("feedLatestHits", { baseDir, now });
      const second = await incrementMetric("feedLatestHits", { baseDir, now });

      expect(first.feedLatestHits).toBe(1);
      expect(second.feedLatestHits).toBe(2);

      const read = await readDailyMetrics({ baseDir, now });
      expect(read.date).toBe("2026-02-18");
      expect(read.feedLatestHits).toBe(2);
      expect(read.healthHits).toBe(0);
      expect(read.launchPageHits).toBe(0);
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it("tracks different counters independently", async () => {
    const baseDir = mkdtempSync(path.join(tmpdir(), "zyntra-metrics-"));
    const now = new Date("2026-02-19T00:00:00.000Z");

    try {
      await incrementMetric("feedHistoryHits", { baseDir, now });
      await incrementMetric("healthHits", { baseDir, now });
      await incrementMetric("premiumPullHits", { baseDir, now });
      await incrementMetric("launchPageHits", { baseDir, now });

      const read = await readDailyMetrics({ baseDir, now });
      expect(read.feedLatestHits).toBe(0);
      expect(read.feedHistoryHits).toBe(1);
      expect(read.healthHits).toBe(1);
      expect(read.premiumPullHits).toBe(1);
      expect(read.launchPageHits).toBe(1);
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it("initializes empty metrics when file is missing", async () => {
    const baseDir = mkdtempSync(path.join(tmpdir(), "zyntra-metrics-"));
    const now = new Date("2026-02-20T00:00:00.000Z");

    try {
      const read = await readDailyMetrics({ baseDir, now });
      expect(read).toEqual({
        date: "2026-02-20",
        feedLatestHits: 0,
        feedHistoryHits: 0,
        healthHits: 0,
        premiumPullHits: 0,
        launchPageHits: 0,
      });
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it("stores only aggregate counters without PII fields", async () => {
    const baseDir = mkdtempSync(path.join(tmpdir(), "zyntra-metrics-"));
    const now = new Date("2026-02-21T00:00:00.000Z");

    try {
      await incrementMetric("launchPageHits", { baseDir, now });
      const read = await readDailyMetrics({ baseDir, now });
      const keys = Object.keys(read).sort();
      expect(keys).toEqual([
        "date",
        "feedHistoryHits",
        "feedLatestHits",
        "healthHits",
        "launchPageHits",
        "premiumPullHits",
      ]);
      expect((read as Record<string, unknown>).ip).toBeUndefined();
      expect((read as Record<string, unknown>).userAgent).toBeUndefined();
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });
});
