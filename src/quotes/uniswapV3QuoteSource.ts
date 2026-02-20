import { Contract, type ContractRunner, formatUnits, parseUnits } from "ethers";
import { retry, sanitizeRpcErrorMessage, withTimeout } from "../rpc/safeCall";
import type { IQuoteSource } from "./IQuoteSource";
import type { QuoteRequest, QuoteResponse } from "./types";
import { UNISWAP_V3_BY_CHAIN } from "./uniswapV3Addresses";

const DEFAULT_FEE_TIERS = [500, 3000, 10000] as const;
const QUOTER_V2_ABI = [
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut,uint160,uint32,uint256)",
] as const;

type ReadonlyProvider = {
  getBlockNumber: () => Promise<number>;
};

type QuoterParams = {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  fee: number;
  sqrtPriceLimitX96: bigint;
};

type QuoterResult = readonly [bigint, bigint, number, bigint];

type QuoteSingleCall = (
  params: QuoterParams,
  overrides?: { blockTag?: number | "latest" },
) => Promise<QuoterResult>;

type QuoterContract = {
  quoteExactInputSingle: QuoteSingleCall & { staticCall?: QuoteSingleCall };
  getFunction?: (name: "quoteExactInputSingle") => { staticCall: QuoteSingleCall };
};

type ContractFactory = (address: string, abi: readonly string[], provider: ReadonlyProvider) => QuoterContract;

export class UniswapV3QuoteSource implements IQuoteSource {
  readonly name = "onchain_univ3" as const;
  private readonly provider: ReadonlyProvider;
  private readonly contractFactory: ContractFactory;
  private readonly timeoutMs: number;
  private readonly retryMax: number;
  private readonly retryBackoffMs: number;
  private readonly retryJitterMs: number;
  private readonly feeTiers: readonly number[];

  constructor(
    provider: ReadonlyProvider,
    options?: {
      contractFactory?: ContractFactory;
      timeoutMs?: number;
      retryMax?: number;
      retryBackoffMs?: number;
      retryJitterMs?: number;
      feeTiers?: readonly number[];
    },
  ) {
    this.provider = provider;
    this.contractFactory =
      options?.contractFactory ??
      ((address, abi, injectedProvider) =>
        new Contract(address, abi, injectedProvider as unknown as ContractRunner) as unknown as QuoterContract);
    this.timeoutMs = options?.timeoutMs ?? 8000;
    this.retryMax = options?.retryMax ?? 2;
    this.retryBackoffMs = options?.retryBackoffMs ?? 250;
    this.retryJitterMs = options?.retryJitterMs ?? 100;
    this.feeTiers = options?.feeTiers ?? DEFAULT_FEE_TIERS;
  }

  private async readWithSafety<T>(fn: () => Promise<T>, timeoutMessage: string): Promise<T> {
    return retry(
      async () => withTimeout(fn(), this.timeoutMs, timeoutMessage),
      {
        max: this.retryMax,
        backoffMs: this.retryBackoffMs,
        jitterMs: this.retryJitterMs,
      },
    );
  }

  async getQuote(req: QuoteRequest): Promise<QuoteResponse> {
    const pair = `${req.baseToken.symbol}/${req.quoteToken.symbol}`;
    const deployment = UNISWAP_V3_BY_CHAIN[req.chainId];

    if (!deployment?.quoterV2) {
      throw new Error(`Uniswap V3 is not configured for chainId ${req.chainId}.`);
    }

    const amountInRaw = parseUnits(req.amountIn.toString(), req.baseToken.decimals);
    const amountInNormalized = Number(formatUnits(amountInRaw, req.baseToken.decimals));
    if (!Number.isFinite(amountInNormalized) || amountInNormalized <= 0) {
      throw new Error(`Invalid amountIn for quote request: ${req.amountIn}`);
    }

    const quoter = this.contractFactory(deployment.quoterV2, QUOTER_V2_ABI, this.provider);

    let best: { amountOutRaw: bigint; feeTier: number } | null = null;
    const perTierFailures: string[] = [];

    for (const feeTier of this.feeTiers) {
      try {
        const overrides = req.blockTag !== undefined ? { blockTag: req.blockTag } : undefined;
        const [amountOutRaw] = await this.readWithSafety(
          () => {
            const params: QuoterParams = {
              tokenIn: req.baseToken.address,
              tokenOut: req.quoteToken.address,
              amountIn: amountInRaw,
              fee: feeTier,
              sqrtPriceLimitX96: 0n,
            };
            const quoteMethod = quoter.quoteExactInputSingle;
            const quoteFunction = typeof quoter.getFunction === "function" ? quoter.getFunction("quoteExactInputSingle") : null;

            // QuoterV2 method is non-view in ABI; force static call for strict read-only behavior.
            if (quoteFunction && typeof quoteFunction.staticCall === "function") {
              return quoteFunction.staticCall(params, overrides);
            }
            if (typeof quoteMethod.staticCall === "function") {
              return quoteMethod.staticCall(params, overrides);
            }

            // Fallback path is only for lightweight test doubles.
            return quoteMethod(params, overrides);
          },
          "Uniswap V3 quote call timed out",
        );

        if (amountOutRaw > 0n && (!best || amountOutRaw > best.amountOutRaw)) {
          best = { amountOutRaw, feeTier };
        }
      } catch (error) {
        perTierFailures.push(`fee=${feeTier}:${sanitizeRpcErrorMessage(error)}`);
      }
    }

    if (!best) {
      throw new Error(
        `Uniswap V3 quote unavailable for pair ${pair}: ${perTierFailures.join(" | ") || "no fee tier succeeded"}`,
      );
    }

    const amountOutNormalized = Number(formatUnits(best.amountOutRaw, req.quoteToken.decimals));
    const price = amountOutNormalized / amountInNormalized;
    const blockNumber =
      typeof req.blockTag === "number"
        ? req.blockTag
        : await this.readWithSafety(() => this.provider.getBlockNumber(), "RPC blockNumber read timed out");

    return {
      source: this.name,
      pair,
      amountIn: amountInNormalized,
      amountOut: amountOutNormalized,
      price,
      blockNumber,
      ts: new Date().toISOString(),
      notes: [`read-only on-chain quote`, `feeTier=${best.feeTier}`],
    };
  }
}
