import type { RpcProviderClient } from "../rpc/manager";
import type { Quote } from "./types";

export type BlockContext = {
  chainId: number;
  blockNumber: number;
  timestamp: string;
};

export const fetchBlockContext = async (provider: RpcProviderClient): Promise<BlockContext> => {
  const [network, blockNumber] = await Promise.all([provider.getNetwork(), provider.getBlockNumber()]);
  const chainId = typeof network.chainId === "bigint" ? Number(network.chainId) : network.chainId;

  return {
    chainId,
    blockNumber,
    timestamp: new Date().toISOString(),
  };
};

export const buildPlaceholderQuotes = (context: BlockContext): Quote[] => {
  const drift = (context.blockNumber % 25) / 10000;
  const basePrice = 2500 + (context.blockNumber % 100);

  return [
    {
      pair: "ETH/USDC",
      price: Number((basePrice * (1 + drift)).toFixed(4)),
      timestamp: context.timestamp,
      source: "placeholder-dex-a",
    },
    {
      pair: "ETH/USDC",
      price: Number((basePrice * (1 - drift / 2)).toFixed(4)),
      timestamp: context.timestamp,
      source: "placeholder-dex-b",
    },
  ];
};
