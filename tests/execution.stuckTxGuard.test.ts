import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isKillSwitchActive } from "../src/execution/killSwitch";
import {
  checkForStuckPendingTransactions,
  clearPendingTx,
  readPendingState,
  recordPendingTx,
} from "../src/execution/stuckTxGuard";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zyntraflow-stuck-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("execution stuck tx guard", () => {
  it("activates kill switch when pending tx exceeds timeout", async () => {
    const dir = makeTempDir();
    const nowMs = Date.now();
    const killSwitch = path.join(dir, "reports", "KILL_SWITCH");
    recordPendingTx(
      {
        txHash: `0x${"c".repeat(64)}`,
        chainId: 8453,
        reportHash: `0x${"d".repeat(64)}`,
        opportunityId: "op-1",
        to: "0x0000000000000000000000000000000000000001",
        sentAtMs: nowMs - 61_000,
      },
      dir,
    );

    const provider = {
      getTransactionReceipt: vi.fn().mockResolvedValue(null),
    };
    const result = await checkForStuckPendingTransactions({
      providersByChain: { 8453: provider as never },
      pendingTimeoutMinutes: 1,
      killSwitchFile: killSwitch,
      nowMs,
      baseDir: dir,
    });

    expect(result.triggered).toBe(true);
    expect(result.stuck.length).toBe(1);
    expect(isKillSwitchActive(killSwitch)).toBe(true);

    const second = await checkForStuckPendingTransactions({
      providersByChain: { 8453: provider as never },
      pendingTimeoutMinutes: 1,
      killSwitchFile: killSwitch,
      nowMs: nowMs + 5_000,
      baseDir: dir,
    });
    expect(second.triggered).toBe(false);
  });

  it("removes pending tx after it is confirmed", async () => {
    const dir = makeTempDir();
    const hash = `0x${"e".repeat(64)}`;
    recordPendingTx(
      {
        txHash: hash,
        chainId: 8453,
        reportHash: `0x${"f".repeat(64)}`,
        opportunityId: "op-2",
        to: "0x0000000000000000000000000000000000000002",
        sentAtMs: Date.now(),
      },
      dir,
    );

    const provider = {
      getTransactionReceipt: vi.fn().mockResolvedValue({ status: 1 }),
    };
    const result = await checkForStuckPendingTransactions({
      providersByChain: { 8453: provider as never },
      pendingTimeoutMinutes: 1,
      killSwitchFile: path.join(dir, "reports", "KILL_SWITCH"),
      baseDir: dir,
    });
    expect(result.pendingCount).toBe(0);
    expect(readPendingState(dir).pending).toEqual([]);

    clearPendingTx(hash, dir);
  });
});
