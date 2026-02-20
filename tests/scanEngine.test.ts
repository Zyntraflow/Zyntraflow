import { describe, expect, it } from "vitest";
import { runScan } from "../src/scanner/scanEngine";
import type { PairConfig } from "../src/pairs/pairs";
import { getToken } from "../src/tokens/tokens";
import type { IQuoteSource } from "../src/quotes/IQuoteSource";
import type { QuoteRequest, QuoteResponse, QuoteSourceName } from "../src/quotes/types";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

class TestQuoteSource implements IQuoteSource {
  readonly name: QuoteSourceName;
  private readonly handler: (req: QuoteRequest) => Promise<QuoteResponse>;

  constructor(name: QuoteSourceName, handler: (req: QuoteRequest) => Promise<QuoteResponse>) {
    this.name = name;
    this.handler = handler;
  }

  async getQuote(req: QuoteRequest): Promise<QuoteResponse> {
    return this.handler(req);
  }
}

const makePair = (quote: "USDC" | "DAI", tradeSizeEth = 1): PairConfig => ({
  chainId: 1,
  base: getToken(1, "WETH"),
  quote: getToken(1, quote),
  enabled: true,
  tradeSizeEth,
  liquidityDepthHint: 100,
});

describe("runScan", () => {
  it("respects pair-task concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const slowSource = new TestQuoteSource("mock", async (req) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await wait(30);
      inFlight -= 1;

      return {
        source: "mock",
        pair: `${req.baseToken.symbol}/${req.quoteToken.symbol}`,
        amountIn: req.amountIn,
        amountOut: req.amountIn * 2000,
        price: 2000,
        blockNumber: 100,
        ts: "2026-02-18T00:00:00.000Z",
        notes: [],
      };
    });

    const fastSource = new TestQuoteSource("onchain_univ3", async (req) => ({
      source: "onchain_univ3",
      pair: `${req.baseToken.symbol}/${req.quoteToken.symbol}`,
      amountIn: req.amountIn,
      amountOut: req.amountIn * 2010,
      price: 2010,
      blockNumber: 100,
      ts: "2026-02-18T00:00:00.000Z",
      notes: [],
    }));

    const pairs = [
      makePair("USDC"),
      makePair("DAI"),
      makePair("USDC"),
      makePair("DAI"),
      makePair("USDC"),
    ];

    const report = await runScan({
      provider: {
        getNetwork: async () => ({ chainId: 1 }),
        getBlockNumber: async () => 100,
      },
      chainId: 1,
      rpcEndpoint: "primary",
      pairs,
      quoteSources: [slowSource, fastSource],
      minProfitGap: 0.001,
      gasPriceGwei: 20,
      gasLimit: 200000,
      maxConcurrency: 3,
    });

    expect(report.pairsScanned).toBe(5);
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("captures per-pair errors and continues scan", async () => {
    const sourceA = new TestQuoteSource("mock", async (req) => ({
      source: "mock",
      pair: `${req.baseToken.symbol}/${req.quoteToken.symbol}`,
      amountIn: req.amountIn,
      amountOut: req.amountIn * 2000,
      price: 2000,
      blockNumber: 101,
      ts: "2026-02-18T00:00:00.000Z",
      notes: [],
    }));

    const sourceB = new TestQuoteSource("onchain_univ3", async (req) => {
      if (req.quoteToken.symbol === "DAI") {
        throw new Error("pair unavailable");
      }

      return {
        source: "onchain_univ3",
        pair: `${req.baseToken.symbol}/${req.quoteToken.symbol}`,
        amountIn: req.amountIn,
        amountOut: req.amountIn * 2040,
        price: 2040,
        blockNumber: 101,
        ts: "2026-02-18T00:00:00.000Z",
        notes: [],
      };
    });

    const report = await runScan({
      provider: {
        getNetwork: async () => ({ chainId: 1 }),
        getBlockNumber: async () => 101,
      },
      chainId: 1,
      rpcEndpoint: "primary",
      pairs: [makePair("USDC"), makePair("DAI")],
      quoteSources: [sourceA, sourceB],
      minProfitGap: 0.001,
      gasPriceGwei: 20,
      gasLimit: 200000,
      maxConcurrency: 2,
    });

    expect(report.pairsScanned).toBe(2);
    expect(report.errors.length).toBe(1);
    expect(report.errors[0].pair).toBe("WETH/DAI");
  });

  it("produces simulation outputs with expected fields", async () => {
    const sourceA = new TestQuoteSource("mock", async (req) => ({
      source: "mock",
      pair: `${req.baseToken.symbol}/${req.quoteToken.symbol}`,
      amountIn: req.amountIn,
      amountOut: req.amountIn * 2000,
      price: 2000,
      blockNumber: 200,
      ts: "2026-02-18T00:00:00.000Z",
      notes: [],
    }));

    const sourceB = new TestQuoteSource("onchain_univ3", async (req) => ({
      source: "onchain_univ3",
      pair: `${req.baseToken.symbol}/${req.quoteToken.symbol}`,
      amountIn: req.amountIn,
      amountOut: req.amountIn * 2100,
      price: 2100,
      blockNumber: 200,
      ts: "2026-02-18T00:00:00.000Z",
      notes: [],
    }));

    const report = await runScan({
      provider: {
        getNetwork: async () => ({ chainId: 1 }),
        getBlockNumber: async () => 200,
      },
      chainId: 1,
      rpcEndpoint: "primary",
      pairs: [makePair("USDC", 1)],
      quoteSources: [sourceA, sourceB],
      minProfitGap: 0.001,
      gasPriceGwei: 15,
      gasLimit: 180000,
      maxConcurrency: 1,
    });

    expect(report.simulations.length).toBe(1);
    expect(report.rankedOpportunities.length).toBe(1);
    expect(report.rankedOpportunities[0].score).toBeGreaterThan(-1);
    const simulation = report.simulations[0];
    expect(simulation.simulation.gasCostEth).toBeGreaterThan(0);
    expect(typeof simulation.simulation.passesThreshold).toBe("boolean");
    expect(Array.isArray(simulation.simulation.riskFlags)).toBe(true);
  });
});
