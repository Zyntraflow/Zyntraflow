export type ExecutionDecision = {
  allowed: boolean;
  reason?: string;
};

export type ExecutionPlan = {
  chainId: number;
  to: string;
  data: string;
  valueEth: number;
  expectedNetProfitEth: number;
  maxGasGwei: number;
  maxSlippageBps: number;
  reportHash: string;
  opportunityId: string;
  gasGwei?: number;
  slippageBps?: number;
  adapter?: string;
  metadata?: Record<string, string>;
};

export type ExecutionPolicyState = {
  date: string;
  dailyPnlEth: number;
  dailyLossEth: number;
  lastTradeAt: string | null;
  lastTxHash: string | null;
  consecutiveFailures: number;
};

export type ExecutionSimulationResult = {
  ok: boolean;
  gasEstimate?: bigint;
  error?: string;
};

export type ExecutionSendStatus = "disabled" | "blocked" | "sim_failed" | "sent" | "error";

export type ExecutionSendResult = {
  status: ExecutionSendStatus;
  reason?: string;
  txHash?: string;
  lastTradeAt?: string | null;
  policyReason?: string;
  simulationError?: string;
};
