import { Contract, type ContractRunner, formatUnits, parseUnits } from "ethers";
import type { IQuoteSource } from "./IQuoteSource";
import type { QuoteRequest, QuoteResponse } from "./types";
import { retry, sanitizeRpcErrorMessage, withTimeout } from "../rpc/safeCall";

type ReadonlyProvider = {
  getBlockNumber: () => Promise<number>;
};

type RouterContract = {
  getAmountsOut: (
    amountIn: bigint,
    path: string[],
    overrides?: { blockTag?: number | "latest" },
  ) => Promise<readonly bigint[]>;
};

type ContractFactory = (address: string, abi: readonly string[], provider: ReadonlyProvider) => RouterContract;

export const UNISWAP_V2_ROUTER_BY_CHAIN: Record<number, string> = {
  1: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
};

const UNISWAP_V2_ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)",
] as const;

const sanitizeErrorMessage = (error: unknown): string => {
  return sanitizeRpcErrorMessage(error);
};

export class UniswapV2QuoteSource implements IQuoteSource {
  readonly name = "onchain_univ2" as const;
  private readonly provider: ReadonlyProvider;
  private readonly contractFactory: ContractFactory;
  private readonly timeoutMs: number;
  private readonly retryMax: number;
  private readonly retryBackoffMs: number;
  private readonly retryJitterMs: number;

  constructor(
    provider: ReadonlyProvider,
    options?: {
      contractFactory?: ContractFactory;
      timeoutMs?: number;
      retryMax?: number;
      retryBackoffMs?: number;
      retryJitterMs?: number;
    },
  ) {
    this.provider = provider;
    this.contractFactory =
      options?.contractFactory ??
      ((address, abi, injectedProvider) =>
        new Contract(address, abi, injectedProvider as unknown as ContractRunner) as unknown as RouterContract);
    this.timeoutMs = options?.timeoutMs ?? 8000;
    this.retryMax = options?.retryMax ?? 2;
    this.retryBackoffMs = options?.retryBackoffMs ?? 250;
    this.retryJitterMs = options?.retryJitterMs ?? 100;
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
    const routerAddress = UNISWAP_V2_ROUTER_BY_CHAIN[req.chainId];
    const pair = `${req.baseToken.symbol}/${req.quoteToken.symbol}`;

    if (!routerAddress) {
      throw new Error(`Uniswap V2 is not configured for chainId ${req.chainId}.`);
    }

    const amountInRaw = parseUnits(req.amountIn.toString(), req.baseToken.decimals);
    const amountInNormalized = Number(formatUnits(amountInRaw, req.baseToken.decimals));
    if (!Number.isFinite(amountInNormalized) || amountInNormalized <= 0) {
      throw new Error(`Invalid amountIn for quote request: ${req.amountIn}`);
    }

    const router = this.contractFactory(routerAddress, UNISWAP_V2_ROUTER_ABI, this.provider);

    let amounts: readonly bigint[];
    try {
      const overrides = req.blockTag !== undefined ? { blockTag: req.blockTag } : undefined;
      amounts = await this.readWithSafety(
        () => router.getAmountsOut(amountInRaw, [req.baseToken.address, req.quoteToken.address], overrides),
        "Uniswap V2 quote call timed out",
      );
    } catch (error) {
      const sanitized = sanitizeErrorMessage(error);
      const wrapped = new Error(`Uniswap V2 quote unavailable for pair ${pair}: ${sanitized}`);
      Object.assign(wrapped, { cause: error });
      throw wrapped;
    }

    if (amounts.length < 2) {
      throw new Error(`Uniswap V2 returned invalid amount path for pair ${pair}.`);
    }

    const amountOutRaw = amounts[1];
    const amountOutNormalized = Number(formatUnits(amountOutRaw, req.quoteToken.decimals));
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
      notes: ["read-only on-chain quote"],
    };
  }
}
