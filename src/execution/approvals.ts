import { Contract, Wallet, parseUnits } from "ethers";
import type { ExecutionConfig } from "../config";
import type { RpcProviderClient } from "../rpc/manager";
import { getNextNonce, updateNonce } from "./nonceManager";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
];

export type ApproveTokenInput = {
  provider: RpcProviderClient;
  config: ExecutionConfig;
  chainId: number;
  token: string;
  spender: string;
  amount: string;
  decimals: number;
  baseDir?: string;
};

const normalizeAddress = (value: string, label: "token" | "spender"): string => {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${label} address.`);
  }
  return value;
};

const parseAmount = (amount: string, decimals: number): bigint => {
  if (amount.trim() === "") {
    throw new Error("Amount is required.");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("Decimals must be an integer between 0 and 36.");
  }
  return parseUnits(amount, decimals);
};

export const approveToken = async (input: ApproveTokenInput): Promise<{ txHash: string }> => {
  if (!input.config.APPROVALS_ENABLED) {
    throw new Error("Approvals are disabled. Set APPROVALS_ENABLED=true in local .env.execution.");
  }

  if (input.chainId !== input.config.CHAIN_ID) {
    throw new Error(`Approval chain mismatch. Expected chainId ${input.config.CHAIN_ID}.`);
  }

  if (!input.config.PRIVATE_KEY) {
    throw new Error("EXECUTION_PRIVATE_KEY is required for approvals.");
  }

  const token = normalizeAddress(input.token, "token").toLowerCase();
  const spender = normalizeAddress(input.spender, "spender").toLowerCase();
  const amountWeiRaw = parseAmount(input.amount, input.decimals);
  const allowlist = new Set(input.config.APPROVALS_ALLOWLIST.map((address) => address.toLowerCase()));
  if (allowlist.size > 0 && (!allowlist.has(token) || !allowlist.has(spender))) {
    throw new Error("Token or spender is not in APPROVALS_ALLOWLIST_JSON.");
  }
  const maxAmount = input.config.APPROVALS_MAX_AMOUNT;
  const amountWeiCap = maxAmount > 0 ? parseAmount(maxAmount.toString(), input.decimals) : 0n;
  const amountWei = maxAmount > 0 && amountWeiRaw > amountWeiCap ? amountWeiCap : amountWeiRaw;

  const wallet = new Wallet(input.config.PRIVATE_KEY, input.provider as never);
  const nonce = await getNextNonce(input.provider, input.chainId, wallet.address, input.baseDir);
  const contract = new Contract(token, ERC20_ABI, wallet);
  const response = await contract.approve(spender, amountWei, { nonce });
  updateNonce(input.chainId, wallet.address, nonce, input.baseDir);
  return {
    txHash: response.hash as string,
  };
};

export const approveERC20 = approveToken;
