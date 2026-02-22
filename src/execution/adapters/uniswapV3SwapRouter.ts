import { Contract, Interface, parseUnits } from "ethers";
import { getToken } from "../../tokens/tokens";
import { UNISWAP_V3_BY_CHAIN } from "../../quotes/uniswapV3Addresses";
import type { RpcProviderClient } from "../../rpc/manager";
import type { ExecutionPlan } from "../types";

const SWAP_ROUTER_INTERFACE = new Interface([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);

const ERC20_ALLOWANCE_ABI = ["function allowance(address owner, address spender) view returns (uint256)"];

const SUPPORTED_PAIR_KEYS = new Set(["WETH/USDC"]);
const DEFAULT_FEE_TIER = 3000;

export type BuildUniswapV3ExecutionPlanInput = {
  chainId: number;
  pairKey: string;
  recipient: string;
  tradeSizeEth: number;
  expectedPrice: number;
  expectedNetProfitEth: number;
  gasGwei: number;
  slippageBps: number;
  reportHash: string;
  opportunityId: string;
};

const normalizePairKey = (pairKey: string): string => pairKey.trim().toUpperCase();

const validateSupportedPair = (pairKey: string): void => {
  if (!SUPPORTED_PAIR_KEYS.has(normalizePairKey(pairKey))) {
    throw new Error(`Unsupported execution pair: ${pairKey}. Allowed: WETH/USDC.`);
  }
};

export const buildUniswapV3ExecutionPlan = (
  input: BuildUniswapV3ExecutionPlanInput,
): ExecutionPlan => {
  validateSupportedPair(input.pairKey);

  const deployment = UNISWAP_V3_BY_CHAIN[input.chainId];
  if (!deployment?.router) {
    throw new Error(`Uniswap V3 router is not configured for chain ${input.chainId}.`);
  }
  if (input.expectedPrice <= 0 || !Number.isFinite(input.expectedPrice)) {
    throw new Error("Expected execution price must be a positive number.");
  }

  const tokenIn = getToken(input.chainId, "WETH");
  const tokenOut = getToken(input.chainId, "USDC");
  const amountIn = parseUnits(input.tradeSizeEth.toFixed(tokenIn.decimals), tokenIn.decimals);
  const expectedOut = parseUnits(input.tradeSizeEth * input.expectedPrice >= 0 ? (input.tradeSizeEth * input.expectedPrice).toFixed(tokenOut.decimals) : "0", tokenOut.decimals);
  const clampedSlippageBps = Math.max(0, Math.min(10_000, Math.floor(input.slippageBps)));
  const amountOutMinimum = (expectedOut * BigInt(10_000 - clampedSlippageBps)) / 10_000n;

  const data = SWAP_ROUTER_INTERFACE.encodeFunctionData("exactInputSingle", [
    {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      fee: DEFAULT_FEE_TIER,
      recipient: input.recipient,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0,
    },
  ]);

  return {
    chainId: input.chainId,
    to: deployment.router,
    data,
    valueEth: input.tradeSizeEth,
    expectedNetProfitEth: input.expectedNetProfitEth,
    maxGasGwei: input.gasGwei,
    maxSlippageBps: clampedSlippageBps,
    gasGwei: input.gasGwei,
    slippageBps: clampedSlippageBps,
    reportHash: input.reportHash,
    opportunityId: input.opportunityId,
    adapter: "uniswap_v3_exact_input_single",
    metadata: {
      spender: deployment.router,
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountInWei: amountIn.toString(),
      expectedAmountOutWei: expectedOut.toString(),
      txValueEth: "0",
      feeTier: String(DEFAULT_FEE_TIER),
    },
  };
};

export const hasSufficientAllowance = async (
  provider: RpcProviderClient,
  owner: string,
  tokenAddress: string,
  spender: string,
  requiredAmountWei: bigint,
): Promise<boolean> => {
  const contract = new Contract(tokenAddress, ERC20_ALLOWANCE_ABI, provider);
  const allowance = (await contract.allowance(owner, spender)) as bigint;
  return allowance >= requiredAmountWei;
};
