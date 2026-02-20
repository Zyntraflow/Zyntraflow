import type { ScanReport } from "../scanner/scanEngine";

export type FreeSummary = {
  ts: number;
  chainId: number;
  rpcName: string;
  pairsScanned: number;
  topOpportunities: Array<{
    chainId: number;
    pair: string;
    netProfitEth: number;
    gasCostEth: number;
    slippagePercent: number;
    riskFlags: string[];
    score: number;
  }>;
  reportHash: string;
  premiumAvailable: boolean;
};

export const buildFreeSummary = (
  scanReport: ScanReport,
  reportHash: string,
  options?: { topN?: number; premiumAvailable?: boolean },
): FreeSummary => {
  const topN = options?.topN ?? 3;
  const ts = Number.isFinite(Date.parse(scanReport.ts)) ? Date.parse(scanReport.ts) : Date.now();

  const topOpportunities = scanReport.simulations
    .slice();
  const ranked = scanReport.rankedOpportunities?.length
    ? scanReport.rankedOpportunities
    : topOpportunities
        .map((simulation) => ({
          ...simulation,
          score: simulation.simulation.netProfitEth,
        }))
        .sort((left, right) => right.score - left.score);

  const selectedTop = ranked.slice(0, topN).map((simulation) => ({
    chainId: simulation.chainId,
    pair: simulation.pair,
    netProfitEth: simulation.simulation.netProfitEth,
    gasCostEth: simulation.simulation.gasCostEth,
    slippagePercent: simulation.simulation.slippagePercent,
    riskFlags: simulation.simulation.riskFlags,
    score: simulation.score,
  }));

  return {
    ts,
    chainId: scanReport.chainId,
    rpcName: scanReport.rpcEndpoint,
    pairsScanned: scanReport.pairsScanned,
    topOpportunities: selectedTop,
    reportHash,
    premiumAvailable: options?.premiumAvailable ?? false,
  };
};
