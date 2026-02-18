import { describe, expect, it, vi } from "vitest";
import { RpcManager, type RpcProviderClient } from "../src/rpc/manager";
import type { RpcEndpoint } from "../src/rpc/types";

const endpoints: RpcEndpoint[] = [
  { name: "primary", url: "http://primary.local", priority: 1 },
  { name: "fallback-1", url: "http://fallback.local", priority: 2 },
];

const createProvider = (chainId: number, blockNumber: number, shouldFail = false): RpcProviderClient => {
  return {
    getNetwork: vi.fn(async () => {
      if (shouldFail) {
        throw new Error("network unavailable");
      }
      return { chainId };
    }),
    getBlockNumber: vi.fn(async () => {
      if (shouldFail) {
        throw new Error("block unavailable");
      }
      return blockNumber;
    }),
  };
};

describe("RpcManager", () => {
  it("selects primary endpoint when healthy", async () => {
    const providers = {
      primary: createProvider(42161, 123456),
      "fallback-1": createProvider(42161, 123450),
    };

    const manager = new RpcManager(endpoints, {
      providerFactory: (endpoint) => providers[endpoint.name as keyof typeof providers],
    });

    const best = await manager.getBestProvider();
    expect(best.endpoint.name).toBe("primary");
    expect(best.health.ok).toBe(true);
  });

  it("falls back when primary is unhealthy", async () => {
    const providers = {
      primary: createProvider(42161, 123456, true),
      "fallback-1": createProvider(42161, 123460),
    };

    const manager = new RpcManager(endpoints, {
      providerFactory: (endpoint) => providers[endpoint.name as keyof typeof providers],
    });

    const best = await manager.getBestProvider();
    expect(best.endpoint.name).toBe("fallback-1");
    expect(best.health.ok).toBe(true);
  });

  it("uses health cache inside ttl window", async () => {
    const provider = createProvider(42161, 123456);
    const manager = new RpcManager([endpoints[0]], {
      healthTtlMs: 30000,
      providerFactory: () => provider,
    });

    await manager.checkHealth(endpoints[0]);
    await manager.checkHealth(endpoints[0]);

    expect(provider.getNetwork).toHaveBeenCalledTimes(1);
    expect(provider.getBlockNumber).toHaveBeenCalledTimes(1);
  });
});
