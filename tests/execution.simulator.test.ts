import { describe, expect, it, vi } from "vitest";
import { simulateTransaction } from "../src/execution/simulator";
import type { ExecutionPlan } from "../src/execution/types";

const makePlan = (): ExecutionPlan => ({
  chainId: 8453,
  to: "0x2626664c2603336E57B271c5C0b26F421741e481",
  data: "0x1234",
  valueEth: 0,
  expectedNetProfitEth: 0.005,
  maxGasGwei: 5,
  maxSlippageBps: 20,
  reportHash: `0x${"2".repeat(64)}`,
  opportunityId: "sim-test",
});

describe("execution simulator", () => {
  it("returns gas estimate when eth_call and estimateGas pass", async () => {
    const provider = {
      call: vi.fn().mockResolvedValue("0x"),
      estimateGas: vi.fn().mockResolvedValue(21000n),
    };

    const result = await simulateTransaction(provider as never, makePlan());
    expect(result.ok).toBe(true);
    expect(result.gasEstimate).toBe(21000n);
  });

  it("returns failure when simulation call reverts", async () => {
    const provider = {
      call: vi.fn().mockRejectedValue(new Error("execution reverted")),
      estimateGas: vi.fn(),
    };

    const result = await simulateTransaction(provider as never, makePlan(), {
      retryMax: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("execution reverted");
  });
});
