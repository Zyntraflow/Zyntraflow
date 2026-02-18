import type { Opportunity, OpportunityReport, Quote } from "./types";

type DetectionInput = {
  quotes: Quote[];
  minProfitGap: number;
};

const estimateNetGap = (grossGap: number): number => {
  const estimatedCosts = 0.0015;
  return grossGap - estimatedCosts;
};

export const detectOpportunities = ({ quotes, minProfitGap }: DetectionInput): OpportunityReport => {
  const opportunities: Opportunity[] = [];

  for (let buyIndex = 0; buyIndex < quotes.length; buyIndex += 1) {
    for (let sellIndex = 0; sellIndex < quotes.length; sellIndex += 1) {
      if (buyIndex === sellIndex) {
        continue;
      }

      const buyQuote = quotes[buyIndex];
      const sellQuote = quotes[sellIndex];
      if (buyQuote.pair !== sellQuote.pair || buyQuote.source === sellQuote.source) {
        continue;
      }

      const grossGap = (sellQuote.price - buyQuote.price) / buyQuote.price;
      if (grossGap < minProfitGap) {
        continue;
      }

      opportunities.push({
        pair: buyQuote.pair,
        buyFrom: buyQuote.source,
        sellTo: sellQuote.source,
        grossGap: Number(grossGap.toFixed(6)),
        netGapEstimate: Number(estimateNetGap(grossGap).toFixed(6)),
        notes: ["dry-run only", "no execution path enabled"],
      });
    }
  }

  opportunities.sort((a, b) => b.netGapEstimate - a.netGapEstimate);

  return {
    checkedAt: new Date().toISOString(),
    minProfitGap,
    quoteCount: quotes.length,
    opportunityCount: opportunities.length,
    opportunities,
  };
};
