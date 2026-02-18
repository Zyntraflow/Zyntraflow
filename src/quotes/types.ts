import type { TokenDefinition } from "../tokens/tokens";

export type QuoteSourceName = "onchain_univ2" | "onchain_univ3" | "mock";

export type QuoteRequest = {
  chainId: number;
  baseToken: TokenDefinition;
  quoteToken: TokenDefinition;
  amountIn: number;
  blockTag?: number | "latest";
};

export type QuoteResponse = {
  source: QuoteSourceName;
  pair: string;
  amountIn: number;
  amountOut: number;
  price: number;
  blockNumber: number;
  ts: string;
  notes: string[];
};
