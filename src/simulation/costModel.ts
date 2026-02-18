export interface CostModelInput {
  gasPriceGwei: number;
  gasLimit: number;
  ethPriceUsd?: number;
}

export interface CostEstimate {
  gasCostEth: number;
  gasCostUsd?: number;
}

export const estimateGasCost = (input: CostModelInput): CostEstimate => {
  const gasCostEth = input.gasPriceGwei * 1e-9 * input.gasLimit;

  if (typeof input.ethPriceUsd === "number") {
    return {
      gasCostEth,
      gasCostUsd: gasCostEth * input.ethPriceUsd,
    };
  }

  return { gasCostEth };
};
