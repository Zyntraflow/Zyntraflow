import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExecutionConfig } from "../src/config";
import { executePlan } from "../src/execution/sender";
import type { ExecutionPlan } from "../src/execution/types";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zyntraflow-exec-sender-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const makeConfig = (baseDir: string, enabled: boolean): ExecutionConfig => ({
  ENABLED: enabled,
  CHAIN_ID: 8453,
  PRIVATE_KEY: `0x${"1".repeat(64)}`,
  MAX_TRADE_ETH: 0.05,
  MAX_GAS_GWEI: 10,
  MAX_SLIPPAGE_BPS: 100,
  MIN_NET_PROFIT_ETH: 0.001,
  DAILY_LOSS_LIMIT_ETH: 0.1,
  COOLDOWN_SECONDS: 0,
  TO_ADDRESS_ALLOWLIST: [],
  KILL_SWITCH_FILE: path.join(baseDir, "reports", "KILL_SWITCH"),
});

const makePlan = (): ExecutionPlan => ({
  chainId: 8453,
  to: "0x2626664c2603336E57B271c5C0b26F421741e481",
  data: "0x1234",
  valueEth: 0.01,
  expectedNetProfitEth: 0.01,
  maxGasGwei: 5,
  maxSlippageBps: 20,
  gasGwei: 3,
  slippageBps: 20,
  reportHash: `0x${"3".repeat(64)}`,
  opportunityId: "sender-test",
});

describe("execution sender", () => {
  it("does not send when execution is disabled", async () => {
    const dir = makeTempDir();
    const provider = {
      call: vi.fn(),
      estimateGas: vi.fn(),
    };
    const result = await executePlan({
      provider: provider as never,
      plan: makePlan(),
      config: makeConfig(dir, false),
      baseDir: dir,
    });

    expect(result.status).toBe("disabled");
    expect(provider.call).not.toHaveBeenCalled();
    expect(provider.estimateGas).not.toHaveBeenCalled();
  });
});
