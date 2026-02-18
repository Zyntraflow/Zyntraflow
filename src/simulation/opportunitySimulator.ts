import { estimateGasCost } from "./costModel";
import { estimateSlippagePercent } from "./slippage";

export interface SimulationInput {
  grossGap: number;
  tradeSizeEth: number;
  gasPriceGwei: number;
  gasLimit: number;
  liquidityDepth: number;
  minProfitGap: number;
}

export interface SimulationResult {
  grossProfitEth: number;
  netProfitEth: number;
  gasCostEth: number;
  slippagePercent: number;
  passesThreshold: boolean;
  riskFlags: string[];
}

export const simulateOpportunity = (input: SimulationInput): SimulationResult => {
  const grossProfitEth = input.grossGap * input.tradeSizeEth;
  const slippagePercent = estimateSlippagePercent({
    tradeSize: input.tradeSizeEth,
    liquidityDepth: input.liquidityDepth,
  });
  const gasCostEth = estimateGasCost({
    gasPriceGwei: input.gasPriceGwei,
    gasLimit: input.gasLimit,
  }).gasCostEth;

  const profitAfterSlippage = grossProfitEth * (1 - slippagePercent);
  const netProfitEth = profitAfterSlippage - gasCostEth;
  const passesThreshold = netProfitEth > input.minProfitGap;

  const riskFlags: string[] = [];
  if (slippagePercent > 0.05) {
    riskFlags.push("HIGH_SLIPPAGE");
  }
  if (netProfitEth < gasCostEth * 2) {
    riskFlags.push("LOW_NET_MARGIN");
  }
  if (netProfitEth <= 0) {
    riskFlags.push("NEGATIVE_PROFIT");
  }

  return {
    grossProfitEth,
    netProfitEth,
    gasCostEth,
    slippagePercent,
    passesThreshold,
    riskFlags,
  };
};
