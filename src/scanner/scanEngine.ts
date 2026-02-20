import type { Opportunity } from "../market/types";
import { detectOpportunities } from "../market/opportunityDetector";
import { scoreOpportunity } from "../market/scoring";
import type { PairConfig } from "../pairs/pairs";
import type { QuoteResponse } from "../quotes/types";
import type { IQuoteSource } from "../quotes/IQuoteSource";
import type { RpcProviderClient } from "../rpc/manager";
import { simulateOpportunity, type SimulationResult } from "../simulation/opportunitySimulator";
import { retry, withTimeout } from "../rpc/safeCall";

export type ScanError = {
  pair: string;
  source?: string;
  message: string;
};

export type PairSimulation = {
  chainId: number;
  pair: string;
  buyFrom: string;
  sellTo: string;
  grossGap: number;
  quoteInputs: QuoteResponse[];
  simulation: SimulationResult;
};

export type RankedOpportunity = PairSimulation & {
  score: number;
};

export type ScanReport = {
  ts: string;
  chainId: number;
  chainIds?: number[];
  rpcEndpoint: string;
  pairsScanned: number;
  opportunities: Opportunity[];
  simulations: PairSimulation[];
  rankedOpportunities: RankedOpportunity[];
  errors: ScanError[];
  chainReports?: Array<Omit<ScanReport, "chainReports">>;
};

export type ScanEngineInput = {
  provider: RpcProviderClient;
  chainId: number;
  rpcEndpoint: string;
  pairs: PairConfig[];
  quoteSources: IQuoteSource[];
  minProfitGap: number;
  gasPriceGwei: number;
  gasLimit: number;
  maxConcurrency?: number;
  blockTag?: number | "latest";
  rpcTimeoutMs?: number;
  rpcRetryMax?: number;
  rpcRetryBackoffMs?: number;
};

const sanitizeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/v2\/)([^/\s?#]+)/gi, "$1[REDACTED]");
};

const runWithConcurrency = async <T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> => {
  if (tasks.length === 0) {
    return [];
  }

  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const taskIndex = cursor;
      cursor += 1;
      if (taskIndex >= tasks.length) {
        return;
      }

      results[taskIndex] = await tasks[taskIndex]();
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
};

export const runScan = async (input: ScanEngineInput): Promise<ScanReport> => {
  const enabledPairs = input.pairs.filter((pair) => pair.enabled);
  const errors: ScanError[] = [];
  const opportunities: Opportunity[] = [];
  const simulations: PairSimulation[] = [];
  const rankedOpportunities: RankedOpportunity[] = [];

  if (input.quoteSources.length < 2) {
    errors.push({
      pair: "*",
      message: "At least two quote sources are required for scanning.",
    });
  }

  const resolvedBlockTag =
    input.blockTag !== undefined
      ? input.blockTag
      : await retry(
          async () =>
            withTimeout(
              input.provider.getBlockNumber(),
              input.rpcTimeoutMs ?? 8000,
              "RPC block number read timed out",
            ),
          {
            max: input.rpcRetryMax ?? 2,
            backoffMs: input.rpcRetryBackoffMs ?? 250,
            jitterMs: 100,
          },
        );
  const pairTasks = enabledPairs.map((pair) => async () => {
    const pairLabel = `${pair.base.symbol}/${pair.quote.symbol}`;
    if (input.quoteSources.length < 2) {
      return;
    }

    const quotes: QuoteResponse[] = [];
    for (const source of input.quoteSources) {
      try {
        const quote = await source.getQuote({
          chainId: input.chainId,
          baseToken: pair.base,
          quoteToken: pair.quote,
          amountIn: pair.tradeSizeEth,
          blockTag: resolvedBlockTag,
        });
        quotes.push(quote);
      } catch (error) {
        errors.push({
          pair: pairLabel,
          source: source.name,
          message: sanitizeErrorMessage(error),
        });
      }
    }

    if (quotes.length < 2) {
      return;
    }

    try {
      const detected = detectOpportunities({
        minProfitGap: input.minProfitGap,
        quotes: quotes.map((quote) => ({
          pair: pairLabel,
          price: quote.price,
          source: quote.source,
          timestamp: quote.ts,
        })),
      });

      opportunities.push(...detected.opportunities);

      for (const opportunity of detected.opportunities) {
        const simulationInput: PairSimulation = {
          chainId: input.chainId,
          pair: opportunity.pair,
          buyFrom: opportunity.buyFrom,
          sellTo: opportunity.sellTo,
          grossGap: opportunity.grossGap,
          quoteInputs: quotes.filter(
            (quote) => quote.source === opportunity.buyFrom || quote.source === opportunity.sellTo,
          ),
          simulation: simulateOpportunity({
            grossGap: opportunity.grossGap,
            tradeSizeEth: pair.tradeSizeEth,
            gasPriceGwei: input.gasPriceGwei,
            gasLimit: input.gasLimit,
            liquidityDepth: pair.liquidityDepthHint,
            minProfitGap: input.minProfitGap,
          }),
        };
        simulations.push(simulationInput);
        rankedOpportunities.push({
          ...simulationInput,
          score: scoreOpportunity(simulationInput.simulation),
        });
      }
    } catch (error) {
      errors.push({
        pair: pairLabel,
        source: "detector",
        message: sanitizeErrorMessage(error),
      });
    }
  });

  await runWithConcurrency(pairTasks, input.maxConcurrency ?? 3);
  rankedOpportunities.sort((left, right) => right.score - left.score);

  return {
    ts: new Date().toISOString(),
    chainId: input.chainId,
    rpcEndpoint: input.rpcEndpoint,
    pairsScanned: enabledPairs.length,
    opportunities,
    simulations,
    rankedOpportunities,
    errors,
  };
};
