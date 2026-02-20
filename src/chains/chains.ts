export type ChainConfig = {
  name: string;
  chainId: number;
  nativeSymbol: string;
  rpcChainName: string;
};

export const CHAINS: Record<number, ChainConfig> = {
  1: {
    name: "mainnet",
    chainId: 1,
    nativeSymbol: "ETH",
    rpcChainName: "eth-mainnet",
  },
  10: {
    name: "optimism",
    chainId: 10,
    nativeSymbol: "ETH",
    rpcChainName: "opt-mainnet",
  },
  137: {
    name: "polygon",
    chainId: 137,
    nativeSymbol: "MATIC",
    rpcChainName: "polygon-mainnet",
  },
  8453: {
    name: "base",
    chainId: 8453,
    nativeSymbol: "ETH",
    rpcChainName: "base-mainnet",
  },
  42161: {
    name: "arbitrum",
    chainId: 42161,
    nativeSymbol: "ETH",
    rpcChainName: "arb-mainnet",
  },
};

export const getChainConfig = (chainId: number): ChainConfig => {
  const chain = CHAINS[chainId];
  if (!chain) {
    throw new Error(`Unsupported chainId: ${chainId}`);
  }

  return chain;
};
