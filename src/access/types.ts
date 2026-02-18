export type AccessStatus = {
  enabled: boolean;
  chainId: number;
  contract: string;
  tokenId: number;
  minBalance: number;
  acceptedChains?: number[];
  contractsByChain?: Record<number, string>;
};

export type AccessCheckResult = {
  hasAccess: boolean;
  balance: string;
  matchedChainId?: number;
  balancesByChain?: Record<number, string>;
  errors?: string[];
};
