import type { AppConfig } from "../config";
import { getChainConfig } from "../chains/chains";
import { RpcManager } from "./manager";
import type { RpcProviderClient } from "./manager";

const extractAlchemyApiKey = (url: string): string | null => {
  const match = url.match(/\/v2\/([^/?#\s]+)/);
  if (!match || !match[1]) {
    return null;
  }
  return match[1];
};

const buildAlchemyUrlForChain = (chainId: number, apiKey: string): string => {
  const chain = getChainConfig(chainId);
  return `https://${chain.rpcChainName}.g.alchemy.com/v2/${apiKey}`;
};

export const createAccessPassRpcManagers = (
  config: Pick<AppConfig, "ALCHEMY_URL" | "RPC_TIMEOUT_MS" | "RPC_RETRY_MAX" | "RPC_RETRY_BACKOFF_MS">,
  chainIds: number[],
): {
  managersByChain: Record<number, RpcManager>;
  errors: string[];
} => {
  return createAlchemyRpcManagers(config, chainIds, "access-chain");
};

export const createAlchemyRpcManagers = (
  config: Pick<AppConfig, "ALCHEMY_URL" | "RPC_TIMEOUT_MS" | "RPC_RETRY_MAX" | "RPC_RETRY_BACKOFF_MS">,
  chainIds: number[],
  endpointPrefix = "scan-chain",
): {
  managersByChain: Record<number, RpcManager>;
  errors: string[];
} => {
  const uniqueChainIds = Array.from(new Set(chainIds));
  const errors: string[] = [];
  const managersByChain: Record<number, RpcManager> = {};
  const apiKey = extractAlchemyApiKey(config.ALCHEMY_URL);
  if (!apiKey) {
    return {
      managersByChain,
      errors: ["Unable to derive Alchemy API key from ALCHEMY_URL for multi-chain access checks."],
    };
  }

  for (const chainId of uniqueChainIds) {
    try {
      const url = buildAlchemyUrlForChain(chainId, apiKey);
      managersByChain[chainId] = new RpcManager([
        {
          name: `${endpointPrefix}-${chainId}`,
          url,
          priority: 1,
        },
      ], {
        timeoutMs: config.RPC_TIMEOUT_MS,
        retryMax: config.RPC_RETRY_MAX,
        retryBackoffMs: config.RPC_RETRY_BACKOFF_MS,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`chain ${chainId}: ${message}`);
    }
  }

  return { managersByChain, errors };
};

export const getProvidersByChain = async (managersByChain: Record<number, RpcManager>): Promise<{
  providersByChain: Record<number, RpcProviderClient>;
  errors: string[];
}> => {
  const providersByChain: Record<number, RpcProviderClient> = {};
  const errors: string[] = [];

  const entries = Object.entries(managersByChain);
  for (const [chainIdRaw, manager] of entries) {
    const chainId = Number(chainIdRaw);
    try {
      const best = await manager.getBestProvider();
      providersByChain[chainId] = best.provider;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`chain ${chainId}: ${message}`);
    }
  }

  return { providersByChain, errors };
};

export const closeRpcManagers = (managersByChain: Record<number, RpcManager>): void => {
  Object.values(managersByChain).forEach((manager) => manager.close());
};
