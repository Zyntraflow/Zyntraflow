import type { PairConfig } from "../pairs/pairs";
import type { IQuoteSource } from "../quotes/IQuoteSource";
import type { RpcProviderClient } from "../rpc/manager";
import { runScan, type ScanReport } from "./scanEngine";

export type ChainScanTask = {
  chainId: number;
  rpcEndpoint: string;
  provider: RpcProviderClient;
  pairs: PairConfig[];
  quoteSources: IQuoteSource[];
  minProfitGap: number;
  gasPriceGwei: number;
  gasLimit: number;
  maxConcurrency: number;
  blockTag?: number | "latest";
  rpcTimeoutMs?: number;
  rpcRetryMax?: number;
  rpcRetryBackoffMs?: number;
};

export type MultiChainScanInput = {
  tasks: ChainScanTask[];
};

export const runMultiChainScan = async (input: MultiChainScanInput): Promise<ScanReport> => {
  if (input.tasks.length === 0) {
    throw new Error("Multi-chain scan requires at least one chain task.");
  }

  const chainReports: ScanReport[] = [];
  for (const task of input.tasks) {
    const report = await runScan({
      provider: task.provider,
      chainId: task.chainId,
      rpcEndpoint: task.rpcEndpoint,
      pairs: task.pairs,
      quoteSources: task.quoteSources,
      minProfitGap: task.minProfitGap,
      gasPriceGwei: task.gasPriceGwei,
      gasLimit: task.gasLimit,
      maxConcurrency: task.maxConcurrency,
      blockTag: task.blockTag,
      rpcTimeoutMs: task.rpcTimeoutMs,
      rpcRetryMax: task.rpcRetryMax,
      rpcRetryBackoffMs: task.rpcRetryBackoffMs,
    });
    chainReports.push(report);
  }

  const primary = chainReports[0];
  const combinedRanked = chainReports
    .flatMap((report) => report.rankedOpportunities)
    .sort((left, right) => right.score - left.score);

  return {
    ts: new Date().toISOString(),
    chainId: primary.chainId,
    chainIds: chainReports.map((report) => report.chainId),
    rpcEndpoint: "multi-chain",
    pairsScanned: chainReports.reduce((sum, report) => sum + report.pairsScanned, 0),
    opportunities: chainReports.flatMap((report) => report.opportunities),
    simulations: chainReports.flatMap((report) => report.simulations),
    rankedOpportunities: combinedRanked,
    errors: chainReports.flatMap((report) =>
      report.errors.map((error) => ({
        ...error,
        pair: `[chain:${report.chainId}] ${error.pair}`,
      })),
    ),
    chainReports,
  };
};
