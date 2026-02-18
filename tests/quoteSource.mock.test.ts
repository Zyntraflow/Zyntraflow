import { parseUnits } from "ethers";
import { describe, expect, it, vi } from "vitest";
import { MockQuoteSource } from "../src/quotes/mockQuoteSource";
import { UniswapV2QuoteSource } from "../src/quotes/uniswapV2QuoteSource";
import { getToken } from "../src/tokens/tokens";

describe("quote sources", () => {
  it("returns deterministic quotes from mock source", async () => {
    const source = new MockQuoteSource({
      prices: {
        "WETH/USDC": 2500,
      },
      fixedBlockNumber: 123,
    });

    const quote = await source.getQuote({
      chainId: 1,
      baseToken: getToken(1, "WETH"),
      quoteToken: getToken(1, "USDC"),
      amountIn: 1,
    });

    expect(quote.source).toBe("mock");
    expect(quote.price).toBe(2500);
    expect(quote.amountOut).toBe(2500);
    expect(quote.blockNumber).toBe(123);
  });

  it("builds uniswap v2 quote using mocked contract call", async () => {
    const provider = {
      getBlockNumber: vi.fn(async () => 100),
    };

    const getAmountsOut = vi.fn(async () => [parseUnits("1", 18), parseUnits("2500", 6)] as const);

    const source = new UniswapV2QuoteSource(provider, {
      contractFactory: () => ({
        getAmountsOut,
      }),
    });

    const quote = await source.getQuote({
      chainId: 1,
      baseToken: getToken(1, "WETH"),
      quoteToken: getToken(1, "USDC"),
      amountIn: 1,
      blockTag: 100,
    });

    expect(quote.source).toBe("onchain_univ2");
    expect(quote.price).toBeCloseTo(2500, 10);
    expect(quote.blockNumber).toBe(100);
    expect(getAmountsOut).toHaveBeenCalledTimes(1);
  });

  it("throws clear error for unsupported chain", async () => {
    const source = new UniswapV2QuoteSource({
      getBlockNumber: vi.fn(async () => 1),
    });

    await expect(
      source.getQuote({
        chainId: 8453,
        baseToken: getToken(1, "WETH"),
        quoteToken: getToken(1, "USDC"),
        amountIn: 1,
      }),
    ).rejects.toThrow("Uniswap V2 is not configured for chainId 8453");
  });
});
