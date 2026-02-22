import { describe, expect, it } from "vitest";
import type { ExecutionConfig } from "../src/config";
import { approveToken } from "../src/execution/approvals";

const baseConfig: ExecutionConfig = {
  ENABLED: true,
  CHAIN_ID: 8453,
  PRIVATE_KEY: `0x${"1".repeat(64)}`,
  APPROVALS_ENABLED: false,
  APPROVALS_MAX_AMOUNT: 0,
  APPROVALS_ALLOWLIST: [],
  MAX_TRADE_ETH: 0.02,
  MAX_GAS_GWEI: 5,
  MAX_SLIPPAGE_BPS: 30,
  MIN_NET_PROFIT_ETH: 0.002,
  DAILY_LOSS_LIMIT_ETH: 0.01,
  COOLDOWN_SECONDS: 30,
  REPLAY_WINDOW_SECONDS: 3600,
  ALLOW_REPLAY: false,
  PENDING_TIMEOUT_SECONDS: 180,
  MAX_CONSECUTIVE_SEND_FAILS: 3,
  TO_ADDRESS_ALLOWLIST: [],
  KILL_SWITCH_FILE: "./reports/KILL_SWITCH",
};

describe("execution approvals", () => {
  it("blocks when approvals are disabled", async () => {
    await expect(
      approveToken({
        provider: {} as never,
        config: baseConfig,
        chainId: 8453,
        token: "0x0000000000000000000000000000000000000001",
        spender: "0x0000000000000000000000000000000000000002",
        amount: "0.01",
        decimals: 18,
      }),
    ).rejects.toThrow("Approvals are disabled");
  });

  it("blocks when token/spender are outside approval allowlist", async () => {
    await expect(
      approveToken({
        provider: {
          getTransactionCount: async () => 1,
        } as never,
        config: {
          ...baseConfig,
          APPROVALS_ENABLED: true,
          APPROVALS_ALLOWLIST: ["0x0000000000000000000000000000000000000003"],
        },
        chainId: 8453,
        token: "0x0000000000000000000000000000000000000001",
        spender: "0x0000000000000000000000000000000000000002",
        amount: "0.01",
        decimals: 18,
      }),
    ).rejects.toThrow("APPROVALS_ALLOWLIST_JSON");
  });
});
