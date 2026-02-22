import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import type { ExecutionConfig } from "../src/config";
import {
  evaluateExecutionPolicy,
  readExecutionPolicyState,
  recordExecutionAttempt,
} from "../src/execution/policy";
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

const makeConfig = (baseDir: string): ExecutionConfig => ({
  ENABLED: true,
  CHAIN_ID: 8453,
  PRIVATE_KEY: undefined,
  APPROVALS_ENABLED: false,
  APPROVALS_MAX_AMOUNT: 0.05,
  MAX_TRADE_ETH: 0.02,
  MAX_GAS_GWEI: 5,
  MAX_SLIPPAGE_BPS: 30,
  MIN_NET_PROFIT_ETH: 0.002,
  DAILY_LOSS_LIMIT_ETH: 0.01,
  COOLDOWN_SECONDS: 0,
  REPLAY_WINDOW_SECONDS: 3600,
  PENDING_TIMEOUT_MINUTES: 10,
  TO_ADDRESS_ALLOWLIST: [],
  KILL_SWITCH_FILE: path.join(baseDir, "reports", "KILL_SWITCH"),
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

describe("execution replay protection", () => {
  it("blocks duplicate (reportHash, opportunityId) within replay window", () => {
    const dir = makeTempDir();
    const cfg = makeConfig(dir);
    const plan = makePlan();

    const initial = evaluateExecutionPolicy(plan, cfg, readExecutionPolicyState(dir), { baseDir: dir });
    expect(initial.allowed).toBe(true);

    recordExecutionAttempt(plan, "policy_allowed", dir, new Date());
    const second = evaluateExecutionPolicy(plan, cfg, readExecutionPolicyState(dir), { baseDir: dir });
    expect(second.allowed).toBe(false);
    expect(second.reason).toBe("REPLAY_PROTECTION_WINDOW_ACTIVE");
  });
});
