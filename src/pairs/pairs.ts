import { getToken } from "../tokens/tokens";
import type { TokenDefinition } from "../tokens/tokens";

export type PairConfig = {
  chainId: number;
  base: TokenDefinition;
  quote: TokenDefinition;
  enabled: boolean;
  tradeSizeEth: number;
  liquidityDepthHint: number;
};

export const toPairKey = (pair: Pick<PairConfig, "base" | "quote">): string => {
  return `${pair.base.symbol}/${pair.quote.symbol}`.toUpperCase();
};

export const PAIRS: PairConfig[] = [
  {
    chainId: 1,
    base: getToken(1, "WETH"),
    quote: getToken(1, "USDC"),
    enabled: true,
    tradeSizeEth: 1,
    liquidityDepthHint: 150,
  },
  {
    chainId: 1,
    base: getToken(1, "WETH"),
    quote: getToken(1, "DAI"),
    enabled: true,
    tradeSizeEth: 1,
    liquidityDepthHint: 120,
  },
  {
    chainId: 42161,
    base: getToken(42161, "WETH"),
    quote: getToken(42161, "USDC"),
    enabled: true,
    tradeSizeEth: 1,
    liquidityDepthHint: 100,
  },
  {
    chainId: 42161,
    base: getToken(42161, "WETH"),
    quote: getToken(42161, "DAI"),
    enabled: true,
    tradeSizeEth: 1,
    liquidityDepthHint: 90,
  },
  {
    chainId: 8453,
    base: getToken(8453, "WETH"),
    quote: getToken(8453, "USDC"),
    enabled: true,
    tradeSizeEth: 1,
    liquidityDepthHint: 100,
  },
  {
    chainId: 8453,
    base: getToken(8453, "WETH"),
    quote: getToken(8453, "DAI"),
    enabled: true,
    tradeSizeEth: 1,
    liquidityDepthHint: 90,
  },
];

export const getEnabledPairsForChain = (chainId: number): PairConfig[] => {
  return PAIRS.filter((pair) => pair.chainId === chainId && pair.enabled);
};

export const getEnabledPairKeysForChain = (chainId: number): string[] => {
  return getEnabledPairsForChain(chainId).map((pair) => toPairKey(pair));
};

export const getEnabledPairsForChainByKeys = (
  chainId: number,
  pairKeys?: string[],
): PairConfig[] => {
  const pairs = getEnabledPairsForChain(chainId);
  if (!pairKeys || pairKeys.length === 0) {
    return pairs;
  }

  const allowed = new Set(pairKeys.map((pair) => pair.trim().toUpperCase()).filter((pair) => pair.length > 0));
  return pairs.filter((pair) => allowed.has(toPairKey(pair)));
};
