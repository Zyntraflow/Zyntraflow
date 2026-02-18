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
];

export const getEnabledPairsForChain = (chainId: number): PairConfig[] => {
  return PAIRS.filter((pair) => pair.chainId === chainId && pair.enabled);
};
