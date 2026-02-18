export type TokenDefinition = {
  symbol: string;
  address: string;
  decimals: number;
};

export const TOKENS_BY_CHAIN: Record<number, Record<string, TokenDefinition>> = {
  1: {
    WETH: {
      symbol: "WETH",
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      decimals: 18,
    },
    USDC: {
      symbol: "USDC",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
    },
    DAI: {
      symbol: "DAI",
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      decimals: 18,
    },
  },
};

export const getToken = (chainId: number, symbol: string): TokenDefinition => {
  const chainTokens = TOKENS_BY_CHAIN[chainId];
  if (!chainTokens) {
    throw new Error(`No token registry configured for chainId ${chainId}`);
  }

  const token = chainTokens[symbol];
  if (!token) {
    throw new Error(`Token ${symbol} is not configured for chainId ${chainId}`);
  }

  return token;
};
