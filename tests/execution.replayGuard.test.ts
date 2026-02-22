import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { hasRecentExecutionAttempt, recordExecutionAttempt } from "../src/execution/replayGuard";
import type { ExecutionPlan } from "../src/execution/types";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zyntraflow-exec-replay-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const makePlan = (): ExecutionPlan => ({
  chainId: 8453,
  to: "0x2626664c2603336E57B271c5C0b26F421741e481",
  data: "0x1234",
  valueEth: 0.01,
  expectedNetProfitEth: 0.004,
  maxGasGwei: 5,
  maxSlippageBps: 20,
  gasGwei: 4,
  slippageBps: 20,
  reportHash: `0x${"a".repeat(64)}`,
  opportunityId: "replay-opportunity",
});

describe("execution replay guard", () => {
  it("returns true when same reportHash/opportunityId exists inside window", () => {
    const dir = makeTempDir();
    const plan = makePlan();
    const now = new Date();

    recordExecutionAttempt(plan, "policy_allowed", dir, now);
    const blocked = hasRecentExecutionAttempt(plan, 6 * 60 * 60, dir, now.getTime() + 1_000);
    expect(blocked).toBe(true);
  });

  it("returns false when attempts are outside replay window", () => {
    const dir = makeTempDir();
    const plan = makePlan();
    const now = new Date();

    recordExecutionAttempt(plan, "policy_allowed", dir, new Date(now.getTime() - 8 * 60 * 60 * 1000));
    const blocked = hasRecentExecutionAttempt(plan, 6 * 60 * 60, dir, now.getTime());
    expect(blocked).toBe(false);
  });
});
