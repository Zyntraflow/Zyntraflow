import { JsonRpcProvider } from "ethers";
import type { RpcEndpoint, RpcHealth } from "./types";
import { retry, sanitizeRpcErrorMessage, withTimeout } from "./safeCall";

type RpcNetwork = {
  chainId: number | bigint;
};

export type RpcProviderClient = {
  getNetwork: () => Promise<RpcNetwork>;
  getBlockNumber: () => Promise<number>;
  destroy?: () => void;
};

type HealthCacheRecord = {
  health: RpcHealth;
  expiresAt: number;
};

export type RpcManagerOptions = {
  healthTtlMs?: number;
  providerFactory?: (endpoint: RpcEndpoint) => RpcProviderClient;
  timeoutMs?: number;
  retryMax?: number;
  retryBackoffMs?: number;
  retryJitterMs?: number;
};

const sanitizeRpcError = (error: unknown): string => {
  return sanitizeRpcErrorMessage(error);
};

export class RpcManager {
  private readonly endpoints: RpcEndpoint[];
  private readonly providers = new Map<string, RpcProviderClient>();
  private readonly healthCache = new Map<string, HealthCacheRecord>();
  private readonly healthTtlMs: number;
  private readonly providerFactory: (endpoint: RpcEndpoint) => RpcProviderClient;
  private readonly timeoutMs: number;
  private readonly retryMax: number;
  private readonly retryBackoffMs: number;
  private readonly retryJitterMs: number;

  constructor(endpoints: RpcEndpoint[], options: RpcManagerOptions = {}) {
    if (endpoints.length === 0) {
      throw new Error("RpcManager requires at least one endpoint.");
    }

    this.endpoints = [...endpoints].sort((a, b) => a.priority - b.priority);
    this.healthTtlMs = options.healthTtlMs ?? 20000;
    this.providerFactory =
      options.providerFactory ?? ((endpoint) => new JsonRpcProvider(endpoint.url) as RpcProviderClient);
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.retryMax = options.retryMax ?? 2;
    this.retryBackoffMs = options.retryBackoffMs ?? 250;
    this.retryJitterMs = options.retryJitterMs ?? 100;
  }

  private getProvider(endpoint: RpcEndpoint): RpcProviderClient {
    const cached = this.providers.get(endpoint.name);
    if (cached) {
      return cached;
    }

    const provider = this.providerFactory(endpoint);
    this.providers.set(endpoint.name, provider);
    return provider;
  }

  async checkHealth(endpoint: RpcEndpoint, forceRefresh = false): Promise<RpcHealth> {
    const now = Date.now();
    const cached = this.healthCache.get(endpoint.name);
    if (!forceRefresh && cached && cached.expiresAt > now) {
      return cached.health;
    }

    const provider = this.getProvider(endpoint);
    const startedAt = Date.now();
    try {
      const callWithSafety = async <T>(fn: () => Promise<T>): Promise<T> => {
        return retry(
          async () => withTimeout(fn(), this.timeoutMs, "RPC health check timed out"),
          {
            max: this.retryMax,
            backoffMs: this.retryBackoffMs,
            jitterMs: this.retryJitterMs,
          },
        );
      };

      const [network, blockNumber] = await Promise.all([
        callWithSafety(() => provider.getNetwork()),
        callWithSafety(() => provider.getBlockNumber()),
      ]);
      const chainId = typeof network.chainId === "bigint" ? Number(network.chainId) : network.chainId;

      const health: RpcHealth = {
        name: endpoint.name,
        ok: true,
        latencyMs: Date.now() - startedAt,
        chainId,
        blockNumber,
        checkedAt: new Date().toISOString(),
      };

      this.healthCache.set(endpoint.name, {
        health,
        expiresAt: now + this.healthTtlMs,
      });

      return health;
    } catch (error) {
      const health: RpcHealth = {
        name: endpoint.name,
        ok: false,
        latencyMs: Date.now() - startedAt,
        chainId: null,
        blockNumber: null,
        error: sanitizeRpcError(error),
        checkedAt: new Date().toISOString(),
      };

      this.healthCache.set(endpoint.name, {
        health,
        expiresAt: now + this.healthTtlMs,
      });

      return health;
    }
  }

  async checkAllHealth(forceRefresh = false): Promise<RpcHealth[]> {
    return Promise.all(this.endpoints.map((endpoint) => this.checkHealth(endpoint, forceRefresh)));
  }

  async getBestProvider(): Promise<{
    endpoint: RpcEndpoint;
    provider: RpcProviderClient;
    health: RpcHealth;
    allHealth: RpcHealth[];
  }> {
    const allHealth = await this.checkAllHealth();
    const healthByName = new Map(allHealth.map((entry) => [entry.name, entry]));

    const candidates = this.endpoints
      .map((endpoint) => {
        const health = healthByName.get(endpoint.name);
        return health ? { endpoint, health } : null;
      })
      .filter((entry): entry is { endpoint: RpcEndpoint; health: RpcHealth } => entry !== null && entry.health.ok)
      .sort((a, b) => {
        if (a.endpoint.priority !== b.endpoint.priority) {
          return a.endpoint.priority - b.endpoint.priority;
        }

        const blockDelta = (b.health.blockNumber ?? -1) - (a.health.blockNumber ?? -1);
        if (blockDelta !== 0) {
          return blockDelta;
        }

        return a.health.latencyMs - b.health.latencyMs;
      });

    const selected = candidates[0];
    if (!selected) {
      const summary = allHealth.map((health) => `${health.name}:${health.error ?? "unavailable"}`).join("; ");
      throw new Error(`No healthy RPC endpoints available. ${summary}`);
    }

    return {
      endpoint: selected.endpoint,
      provider: this.getProvider(selected.endpoint),
      health: selected.health,
      allHealth,
    };
  }

  close(): void {
    for (const provider of this.providers.values()) {
      if (typeof provider.destroy === "function") {
        provider.destroy();
      }
    }
    this.providers.clear();
  }
}
