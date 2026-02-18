export type Token = {
  symbol: string;
  address: string;
  decimals: number;
};

export type Quote = {
  pair: string;
  price: number;
  timestamp: string;
  source: string;
};

export type Opportunity = {
  pair: string;
  buyFrom: string;
  sellTo: string;
  grossGap: number;
  netGapEstimate: number;
  notes: string[];
};

export type OpportunityReport = {
  checkedAt: string;
  minProfitGap: number;
  quoteCount: number;
  opportunityCount: number;
  opportunities: Opportunity[];
};
