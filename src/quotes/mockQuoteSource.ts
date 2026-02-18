import type { IQuoteSource } from "./IQuoteSource";
import type { QuoteRequest, QuoteResponse } from "./types";

type MockPriceMap = Record<string, number>;

const pairKey = (baseSymbol: string, quoteSymbol: string): string => `${baseSymbol}/${quoteSymbol}`;

export class MockQuoteSource implements IQuoteSource {
  readonly name = "mock" as const;
  private readonly prices: MockPriceMap;
  private readonly fixedBlockNumber?: number;

  constructor(options?: { prices?: MockPriceMap; fixedBlockNumber?: number }) {
    this.prices = options?.prices ?? {};
    this.fixedBlockNumber = options?.fixedBlockNumber;
  }

  async getQuote(req: QuoteRequest): Promise<QuoteResponse> {
    const key = pairKey(req.baseToken.symbol, req.quoteToken.symbol);
    const inverseKey = pairKey(req.quoteToken.symbol, req.baseToken.symbol);

    let price = this.prices[key];
    const notes: string[] = [];

    if (price === undefined && this.prices[inverseKey] !== undefined && this.prices[inverseKey] > 0) {
      price = 1 / this.prices[inverseKey];
      notes.push("derived from inverse pair");
    }

    if (price === undefined) {
      price = 1;
      notes.push("fallback mock price used");
    }

    const amountOut = req.amountIn * price;

    return {
      source: this.name,
      pair: key,
      amountIn: req.amountIn,
      amountOut,
      price,
      blockNumber: this.fixedBlockNumber ?? (typeof req.blockTag === "number" ? req.blockTag : 0),
      ts: new Date().toISOString(),
      notes,
    };
  }
}
