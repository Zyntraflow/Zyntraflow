export type ProfileQuoteSource = "univ2" | "univ3";

export type ScanProfile = {
  id: string;
  name: string;
  chains: number[];
  pairs: string[];
  minProfitGap: number;
  quoteSources: ProfileQuoteSource[];
  maxConcurrency: number;
  targetIntervalSeconds: number;
  notes?: string;
  premiumOnly?: boolean;
};

export type SelectedScanProfile = ScanProfile & {
  sourceProfileId: string;
  warnings: string[];
};
