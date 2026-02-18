import { describe, expect, it, vi } from "vitest";
import { checkAccessPassAcrossChains } from "../src/access/accessPass";
import type { AccessStatus } from "../src/access/types";

const status: AccessStatus = {
  enabled: true,
  chainId: 1,
  contract: "0x0000000000000000000000000000000000000001",
  tokenId: 1,
  minBalance: 1,
  acceptedChains: [1, 42161, 8453],
  contractsByChain: {
    1: "0x0000000000000000000000000000000000000001",
    42161: "0x0000000000000000000000000000000000000002",
  },
};

describe("checkAccessPassAcrossChains", () => {
  it("returns access true when any accepted chain has sufficient balance", async () => {
    const providersByChain = {
      1: {},
      42161: {},
    };

    const contractFactory = vi.fn((address: string) => {
      if (address === "0x0000000000000000000000000000000000000001") {
        return { balanceOf: vi.fn(async () => 0n) };
      }
      return { balanceOf: vi.fn(async () => 2n) };
    });

    const result = await checkAccessPassAcrossChains(
      providersByChain,
      "0x000000000000000000000000000000000000dEaD",
      status,
      { contractFactory },
    );

    expect(result.hasAccess).toBe(true);
    expect(result.matchedChainId).toBe(42161);
    expect(result.balance).toBe("2");
  });

  it("records provider and contract availability errors without crashing", async () => {
    const providersByChain = {
      1: {},
    };

    const contractFactory = vi.fn(() => ({
      balanceOf: vi.fn(async () => 0n),
    }));

    const result = await checkAccessPassAcrossChains(
      providersByChain,
      "0x000000000000000000000000000000000000dEaD",
      status,
      { contractFactory },
    );

    expect(result.hasAccess).toBe(false);
    expect((result.errors ?? []).some((entry) => entry.includes("provider unavailable"))).toBe(true);
  });
});
