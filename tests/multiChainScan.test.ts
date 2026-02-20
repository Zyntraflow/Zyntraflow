import { describe, expect, it } from "vitest";
import type { IQuoteSource } from "../src/quotes/IQuoteSource";
import type { PairConfig } from "../src/pairs/pairs";
import { getToken } from "../src/tokens/tokens";
import { runMultiChainScan } from "../src/scanner/multiChainScan";
import type { QuoteRequest, QuoteResponse, QuoteSourceName } from "../src/quotes/types";

class TestQuoteSource implements IQuoteSource {
  readonly name: QuoteSourceName;
  private readonly price: number;

  constructor(name: QuoteSourceName, price: number) {
    this.name = name;
    this.price = price;
  }

  async getQuote(req: QuoteRequest): Promise<QuoteResponse> {
    return {
      source: this.name,
      pair: `${req.baseToken.symbol}/${req.quoteToken.symbol}`,
      amountIn: req.amountIn,
      amountOut: req.amountIn * this.price,
      price: this.price,
      blockNumber: 1000 + req.chainId,
      ts: new Date().toISOString(),
      notes: [],
    };
  }
}

const makePair = (chainId: number, quoteSymbol: "USDC" | "DAI"): PairConfig => ({
  chainId,
  base: getToken(chainId, "WETH"),
  quote: getToken(chainId, quoteSymbol),
  enabled: true,
  tradeSizeEth: 1,
  liquidityDepthHint: 100,
});

describe("runMultiChainScan", () => {
  it("aggregates reports across chains and keeps chain IDs on simulations", async () => {
    const report = await runMultiChainScan({
      tasks: [
        {
          chainId: 8453,
          rpcEndpoint: "base-primary",
          provider: {
            getNetwork: async () => ({ chainId: 8453 }),
            getBlockNumber: async () => 12345,
          },
          pairs: [makePair(8453, "USDC")],
          quoteSources: [new TestQuoteSource("mock", 2000), new TestQuoteSource("onchain_univ3", 2050)],
          minProfitGap: 0.001,
          gasPriceGwei: 20,
          gasLimit: 200000,
          maxConcurrency: 2,
        },
        {
          chainId: 42161,
          rpcEndpoint: "arb-primary",
          provider: {
            getNetwork: async () => ({ chainId: 42161 }),
            getBlockNumber: async () => 22345,
          },
          pairs: [makePair(42161, "USDC")],
          quoteSources: [new TestQuoteSource("mock", 2000), new TestQuoteSource("onchain_univ3", 2075)],
          minProfitGap: 0.001,
          gasPriceGwei: 20,
          gasLimit: 200000,
          maxConcurrency: 2,
        },
      ],
    });

    expect(report.chainIds).toEqual([8453, 42161]);
    expect(report.chainReports).toHaveLength(2);
    expect(report.pairsScanned).toBe(2);
    expect(report.rankedOpportunities.length).toBeGreaterThan(0);
    expect(report.rankedOpportunities.some((entry) => entry.chainId === 8453)).toBe(true);
    expect(report.rankedOpportunities.some((entry) => entry.chainId === 42161)).toBe(true);
  });
});
