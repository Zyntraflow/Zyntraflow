export type PremiumDecisionInput = {
  premiumRequested: boolean;
  hasAccess: boolean;
  reportPersistenceRequested: boolean;
  freeConcurrency: number;
  premiumConcurrency: number;
  freeMaxPairs: number;
  premiumMaxPairs: number;
};

export type PremiumDecision = {
  premiumActive: boolean;
  mode: "free" | "premium";
  maxConcurrency: number;
  maxPairs: number;
  allowReportPersistence: boolean;
  includeRicherReport: boolean;
};

export const resolvePremiumDecision = (input: PremiumDecisionInput): PremiumDecision => {
  if (!input.premiumRequested || !input.hasAccess) {
    return {
      premiumActive: false,
      mode: "free",
      maxConcurrency: input.freeConcurrency,
      maxPairs: input.freeMaxPairs,
      allowReportPersistence: false,
      includeRicherReport: false,
    };
  }

  return {
    premiumActive: true,
    mode: "premium",
    maxConcurrency: input.premiumConcurrency,
    maxPairs: input.premiumMaxPairs,
    allowReportPersistence: input.reportPersistenceRequested,
    includeRicherReport: true,
  };
};
