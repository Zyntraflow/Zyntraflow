import { formatUnits, parseUnits } from "ethers";
import { describe, expect, it, vi } from "vitest";
import { UniswapV3QuoteSource } from "../src/quotes/uniswapV3QuoteSource";
import { getToken } from "../src/tokens/tokens";

describe("UniswapV3QuoteSource", () => {
  it("chooses the best fee tier quote", async () => {
    const provider = {
      getBlockNumber: vi.fn(async () => 123),
    };

    const quoteExactInputSingle = vi.fn(async (params: { fee: number }) => {
      if (params.fee === 500) {
        return [parseUnits("1980", 6), 0n, 0, 0n] as const;
      }
      if (params.fee === 3000) {
        return [parseUnits("2020", 6), 0n, 0, 0n] as const;
      }
      return [parseUnits("1990", 6), 0n, 0, 0n] as const;
    });

    const source = new UniswapV3QuoteSource(provider, {
      contractFactory: () => ({
        quoteExactInputSingle,
      }),
    });

    const quote = await source.getQuote({
      chainId: 42161,
      baseToken: getToken(42161, "WETH"),
      quoteToken: getToken(42161, "USDC"),
      amountIn: 1,
      blockTag: 123,
    });

    expect(quote.source).toBe("onchain_univ3");
    expect(quote.amountOut).toBeCloseTo(Number(formatUnits(parseUnits("2020", 6), 6)), 8);
    expect(quote.notes.join(" ")).toContain("feeTier=3000");
    expect(quoteExactInputSingle).toHaveBeenCalledTimes(3);
  });

  it("throws for unsupported chain", async () => {
    const source = new UniswapV3QuoteSource({
      getBlockNumber: vi.fn(async () => 1),
    });

    await expect(
      source.getQuote({
        chainId: 1,
        baseToken: getToken(1, "WETH"),
        quoteToken: getToken(1, "USDC"),
        amountIn: 1,
      }),
    ).rejects.toThrow("Uniswap V3 is not configured for chainId 1");
  });

  it("throws when all fee tiers fail", async () => {
    const source = new UniswapV3QuoteSource(
      {
        getBlockNumber: vi.fn(async () => 1),
      },
      {
        contractFactory: () => ({
          quoteExactInputSingle: vi.fn(async () => {
            throw new Error("reverted");
          }),
        }),
      },
    );

    await expect(
      source.getQuote({
        chainId: 42161,
        baseToken: getToken(42161, "WETH"),
        quoteToken: getToken(42161, "USDC"),
        amountIn: 1,
      }),
    ).rejects.toThrow("Uniswap V3 quote unavailable");
  });

  it("uses getFunction().staticCall when available to stay read-only", async () => {
    const directCall = vi.fn(async () => {
      throw new Error("contract runner does not support sending transactions");
    });
    const staticCall = vi.fn(async (params: { fee: number }) => {
      if (params.fee === 3000) {
        return [parseUnits("2100", 6), 0n, 0, 0n] as const;
      }
      return [parseUnits("2000", 6), 0n, 0, 0n] as const;
    });

    const source = new UniswapV3QuoteSource(
      {
        getBlockNumber: vi.fn(async () => 123),
      },
      {
        contractFactory: () => ({
          quoteExactInputSingle: directCall,
          getFunction: () => ({
            staticCall,
          }),
        }),
      },
    );

    const quote = await source.getQuote({
      chainId: 42161,
      baseToken: getToken(42161, "WETH"),
      quoteToken: getToken(42161, "USDC"),
      amountIn: 1,
      blockTag: 123,
    });

    expect(quote.amountOut).toBeCloseTo(Number(formatUnits(parseUnits("2100", 6), 6)), 8);
    expect(directCall).not.toHaveBeenCalled();
    expect(staticCall).toHaveBeenCalledTimes(3);
  });
});
