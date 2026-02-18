import { describe, expect, it, vi } from "vitest";
import { checkAccessPass } from "../src/access/accessPass";
import type { AccessStatus } from "../src/access/types";

const baseStatus: AccessStatus = {
  enabled: true,
  chainId: 1,
  contract: "0x0000000000000000000000000000000000000001",
  tokenId: 1,
  minBalance: 1,
};

describe("checkAccessPass", () => {
  it("returns hasAccess=true when balance meets threshold", async () => {
    const contractFactory = vi.fn(() => ({
      balanceOf: vi.fn(async () => 2n),
    }));

    const result = await checkAccessPass(
      {},
      "0x0000000000000000000000000000000000000002",
      baseStatus,
      { contractFactory },
    );

    expect(result.hasAccess).toBe(true);
    expect(result.balance).toBe("2");
  });

  it("returns hasAccess=false when balance is below threshold", async () => {
    const contractFactory = vi.fn(() => ({
      balanceOf: vi.fn(async () => 0n),
    }));

    const result = await checkAccessPass(
      {},
      "0x0000000000000000000000000000000000000002",
      baseStatus,
      { contractFactory },
    );

    expect(result.hasAccess).toBe(false);
    expect(result.balance).toBe("0");
  });

  it("throws if contract address is missing when enabled", async () => {
    await expect(
      checkAccessPass({}, "0x0000000000000000000000000000000000000002", {
        ...baseStatus,
        contract: "",
      }),
    ).rejects.toThrow("Access Pass contract address is not configured");
  });
});
