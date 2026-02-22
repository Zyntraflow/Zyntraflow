import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import type { ExecutionConfig } from "../src/config";
import { createKillSwitch, removeKillSwitch } from "../src/execution/killSwitch";
import { evaluateExecutionPolicy, readExecutionPolicyState, writeExecutionPolicyState } from "../src/execution/policy";
import type { ExecutionPlan } from "../src/execution/types";

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
  COOLDOWN_SECONDS: 30,
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
  expectedNetProfitEth: 0.003,
  maxGasGwei: 5,
  maxSlippageBps: 20,
  gasGwei: 4,
  slippageBps: 20,
  reportHash: `0x${"1".repeat(64)}`,
  opportunityId: "test-opportunity",
});

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zyntraflow-exec-policy-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("execution policy", () => {
  it("allows a valid plan", () => {
    const dir = makeTempDir();
    const cfg = makeConfig(dir);
    const state = readExecutionPolicyState(dir);
    const decision = evaluateExecutionPolicy(makePlan(), cfg, state);
    expect(decision.allowed).toBe(true);
  });

  it("blocks when kill switch file exists", () => {
    const dir = makeTempDir();
    const cfg = makeConfig(dir);
    createKillSwitch(cfg.KILL_SWITCH_FILE);

    const decision = evaluateExecutionPolicy(makePlan(), cfg, readExecutionPolicyState(dir));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("KILL_SWITCH_ACTIVE");

    removeKillSwitch(cfg.KILL_SWITCH_FILE);
  });

  it("enforces cooldown and daily loss limit", () => {
    const dir = makeTempDir();
    const cfg = makeConfig(dir);
    const now = new Date();
    writeExecutionPolicyState(
      {
        date: now.toISOString().slice(0, 10),
        dailyPnlEth: -0.02,
        dailyLossEth: 0.02,
        lastTradeAt: new Date(now.getTime() - 5_000).toISOString(),
        lastTxHash: null,
        consecutiveFailures: 1,
      },
      dir,
    );

    const state = readExecutionPolicyState(dir);
    const decision = evaluateExecutionPolicy(makePlan(), cfg, state, { nowMs: now.getTime() });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("DAILY_LOSS_LIMIT_REACHED");
  });

  it("enforces cooldown when recent trade exists", () => {
    const dir = makeTempDir();
    const cfg = makeConfig(dir);
    const now = new Date();
    writeExecutionPolicyState(
      {
        date: now.toISOString().slice(0, 10),
        dailyPnlEth: 0,
        dailyLossEth: 0,
        lastTradeAt: new Date(now.getTime() - 5_000).toISOString(),
        lastTxHash: null,
        consecutiveFailures: 0,
      },
      dir,
    );

    const state = readExecutionPolicyState(dir);
    const decision = evaluateExecutionPolicy(makePlan(), cfg, state, { nowMs: now.getTime() });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("COOLDOWN_ACTIVE");
  });

  it("enforces to-address allowlist when configured", () => {
    const dir = makeTempDir();
    const cfg = {
      ...makeConfig(dir),
      TO_ADDRESS_ALLOWLIST: ["0x000000000000000000000000000000000000dead"],
    };
    const decision = evaluateExecutionPolicy(makePlan(), cfg, readExecutionPolicyState(dir));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("TO_ADDRESS_NOT_ALLOWLISTED");
  });
});
