export interface SlippageInput {
  tradeSize: number;
  liquidityDepth: number;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

export const estimateSlippagePercent = (input: SlippageInput): number => {
  if (input.liquidityDepth <= 0 || input.tradeSize <= 0) {
    return 0;
  }

  const rawSlippage = input.tradeSize / input.liquidityDepth;
  return clamp(rawSlippage, 0, 0.2);
};
