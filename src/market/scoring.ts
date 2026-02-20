import type { SimulationResult } from "../simulation/opportunitySimulator";

const hasFlag = (sim: SimulationResult, flag: string): boolean => sim.riskFlags.includes(flag);

export const scoreOpportunity = (sim: SimulationResult): number => {
  if (hasFlag(sim, "NEGATIVE_PROFIT")) {
    return -1_000_000;
  }

  let score = sim.netProfitEth;
  const gasRatio = sim.gasCostEth > 0 ? sim.netProfitEth / sim.gasCostEth : sim.netProfitEth * 10;
  score += gasRatio * 0.1;

  if (hasFlag(sim, "HIGH_SLIPPAGE")) {
    score -= 0.25;
  }
  if (hasFlag(sim, "LOW_NET_MARGIN")) {
    score -= 0.05;
  }

  return Number(score.toFixed(8));
};
