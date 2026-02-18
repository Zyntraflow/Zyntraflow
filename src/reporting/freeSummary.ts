import type { ScanReport } from "../scanner/scanEngine";

export type FreeSummary = {
  ts: number;
  chainId: number;
  rpcName: string;
  pairsScanned: number;
  topOpportunities: Array<{
    pair: string;
    netProfitEth: number;
    riskFlags: string[];
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
    .slice()
    .sort((left, right) => right.simulation.netProfitEth - left.simulation.netProfitEth)
    .slice(0, topN)
    .map((simulation) => ({
      pair: simulation.pair,
      netProfitEth: simulation.simulation.netProfitEth,
      riskFlags: simulation.simulation.riskFlags,
    }));

  return {
    ts,
    chainId: scanReport.chainId,
    rpcName: scanReport.rpcEndpoint,
    pairsScanned: scanReport.pairsScanned,
    topOpportunities,
    reportHash,
    premiumAvailable: options?.premiumAvailable ?? false,
  };
};
