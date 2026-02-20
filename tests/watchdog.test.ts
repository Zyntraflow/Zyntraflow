import { describe, expect, it, vi } from "vitest";
import { OperatorWatchdog } from "../src/operator/watchdog";

describe("operator watchdog", () => {
  it("applies exponential backoff, caps delay, and triggers restart after threshold", async () => {
    const sleepCalls: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      sleepCalls.push(ms);
    });
    const closeProviders = vi.fn(async () => undefined);
    const now = vi.fn(() => Date.parse("2026-02-20T00:00:00.000Z"));

    const watchdog = new OperatorWatchdog({
      failureThreshold: 3,
      baseBackoffMs: 100,
      maxBackoffMs: 500,
      sleep,
      closeProviders,
      now,
    });

    const first = await watchdog.recordFailureAndRecover();
    expect(first.restarted).toBe(false);
    expect(first.snapshot.consecutiveFailures).toBe(1);
    expect(first.snapshot.lastBackoffMs).toBe(100);
    expect(first.snapshot.lastRestartAt).toBeNull();

    const second = await watchdog.recordFailureAndRecover();
    expect(second.restarted).toBe(false);
    expect(second.snapshot.consecutiveFailures).toBe(2);
    expect(second.snapshot.lastBackoffMs).toBe(200);

    const third = await watchdog.recordFailureAndRecover();
    expect(third.restarted).toBe(true);
    expect(third.snapshot.consecutiveFailures).toBe(3);
    expect(third.snapshot.lastBackoffMs).toBe(400);
    expect(third.snapshot.lastRestartAt).toBe("2026-02-20T00:00:00.000Z");

    const fourth = await watchdog.recordFailureAndRecover();
    expect(fourth.restarted).toBe(true);
    expect(fourth.snapshot.lastBackoffMs).toBe(500);

    expect(sleepCalls).toEqual([100, 200, 400, 500]);
    expect(closeProviders).toHaveBeenCalledTimes(2);
  });

  it("resets failure counters on success", async () => {
    const watchdog = new OperatorWatchdog({
      failureThreshold: 3,
      baseBackoffMs: 50,
      maxBackoffMs: 1000,
      sleep: async () => undefined,
      closeProviders: async () => undefined,
      now: () => Date.parse("2026-02-20T00:00:00.000Z"),
    });

    await watchdog.recordFailureAndRecover();
    await watchdog.recordFailureAndRecover();

    const success = watchdog.recordSuccess();
    expect(success.consecutiveFailures).toBe(0);
    expect(success.lastBackoffMs).toBe(0);
    expect(success.lastRestartAt).toBeNull();
  });
});

