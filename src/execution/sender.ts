import fs from "fs";
import path from "path";
import { Wallet, parseEther, parseUnits } from "ethers";
import type { ExecutionConfig } from "../config";
import type { RpcProviderClient } from "../rpc/manager";
import {
  evaluateExecutionPolicy,
  readExecutionPolicyState,
  updateExecutionPolicyState,
} from "./policy";
import { simulateTransaction } from "./simulator";
import { hasSufficientAllowance } from "./adapters/uniswapV3SwapRouter";
import type { ExecutionPlan, ExecutionSendResult } from "./types";

const EXECUTION_LOG_PATH = path.join("reports", "execution", "txlog.jsonl");

type ExecutePlanInput = {
  provider: RpcProviderClient;
  plan: ExecutionPlan;
  config: ExecutionConfig;
  timeoutMs?: number;
  retryMax?: number;
  retryBackoffMs?: number;
  baseDir?: string;
};

const sanitizeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/v2\/)([^/\s?#]+)/gi, "$1[REDACTED]")
    .replace(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, "[REDACTED_HEX_64]");
};

const appendTxLog = (entry: Record<string, unknown>, baseDir = process.cwd()): void => {
  const filePath = path.join(baseDir, EXECUTION_LOG_PATH);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, { encoding: "utf8" });
};

const resolveTxValueEth = (plan: ExecutionPlan): number => {
  const raw = plan.metadata?.txValueEth;
  if (!raw || raw.trim() === "") {
    return plan.valueEth;
  }

  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return plan.valueEth;
  }
  return parsed;
};

const resolveGasPriceGwei = (plan: ExecutionPlan, config: ExecutionConfig): number => {
  const candidate = plan.gasGwei ?? plan.maxGasGwei;
  if (!Number.isFinite(candidate) || candidate < 0) {
    return config.MAX_GAS_GWEI;
  }
  return Math.min(candidate, config.MAX_GAS_GWEI);
};

const ensurePreapprovedTokens = async (
  provider: RpcProviderClient,
  walletAddress: string,
  plan: ExecutionPlan,
): Promise<ExecutionSendResult | null> => {
  if (plan.adapter !== "uniswap_v3_exact_input_single") {
    return null;
  }

  const tokenIn = plan.metadata?.tokenIn;
  const spender = plan.metadata?.spender;
  const amountInWeiRaw = plan.metadata?.amountInWei;
  if (!tokenIn || !spender || !amountInWeiRaw) {
    return {
      status: "blocked",
      reason: "EXECUTION_PLAN_MISSING_APPROVAL_METADATA",
    };
  }

  const amountInWei = BigInt(amountInWeiRaw);
  const hasAllowance = await hasSufficientAllowance(provider, walletAddress, tokenIn, spender, amountInWei);
  if (!hasAllowance) {
    return {
      status: "blocked",
      reason: "TOKEN_ALLOWANCE_MISSING_PREAPPROVAL_REQUIRED",
    };
  }
  return null;
};

export const executePlan = async (input: ExecutePlanInput): Promise<ExecutionSendResult> => {
  const now = new Date();
  const policyState = readExecutionPolicyState(input.baseDir);
  const decision = evaluateExecutionPolicy(input.plan, input.config, policyState, {
    nowMs: now.getTime(),
  });

  if (!decision.allowed) {
    return {
      status: input.config.ENABLED ? "blocked" : "disabled",
      policyReason: decision.reason,
      reason: decision.reason,
      lastTradeAt: policyState.lastTradeAt,
    };
  }

  const simulation = await simulateTransaction(input.provider, input.plan, {
    timeoutMs: input.timeoutMs,
    retryMax: input.retryMax,
    retryBackoffMs: input.retryBackoffMs,
  });
  if (!simulation.ok) {
    const updated = updateExecutionPolicyState(
      (current) => ({
        ...current,
        consecutiveFailures: current.consecutiveFailures + 1,
      }),
      input.baseDir,
    );
    return {
      status: "sim_failed",
      simulationError: simulation.error,
      reason: simulation.error,
      lastTradeAt: updated.lastTradeAt,
    };
  }

  if (!input.config.PRIVATE_KEY) {
    return {
      status: "blocked",
      reason: "EXECUTION_PRIVATE_KEY_MISSING",
    };
  }

  const wallet = new Wallet(input.config.PRIVATE_KEY, input.provider);
  const preapprovalResult = await ensurePreapprovedTokens(input.provider, wallet.address, input.plan);
  if (preapprovalResult) {
    return preapprovalResult;
  }

  const txValueEth = resolveTxValueEth(input.plan);
  const value = parseEther(txValueEth.toString());
  const gasPriceGwei = resolveGasPriceGwei(input.plan, input.config);
  const gasPrice = parseUnits(gasPriceGwei.toString(), "gwei");
  const gasLimit = simulation.gasEstimate ? (simulation.gasEstimate * 12n) / 10n : undefined;

  try {
    const response = await wallet.sendTransaction({
      to: input.plan.to,
      data: input.plan.data,
      value,
      gasPrice,
      gasLimit,
    });
    const receipt = await response.wait(1);
    const sentAt = new Date().toISOString();
    const effectiveGasPrice = receipt?.gasPrice ?? response.gasPrice ?? gasPrice;
    const gasUsed = receipt?.gasUsed ?? 0n;
    const gasCostEth = Number(gasUsed * effectiveGasPrice) / 1e18;
    const expectedPnlAfterGas = input.plan.expectedNetProfitEth - gasCostEth;

    const updated = updateExecutionPolicyState(
      (current) => {
        const nextPnl = current.dailyPnlEth + expectedPnlAfterGas;
        const additionalLoss = expectedPnlAfterGas < 0 ? Math.abs(expectedPnlAfterGas) : 0;
        return {
          ...current,
          lastTradeAt: sentAt,
          lastTxHash: response.hash,
          dailyPnlEth: nextPnl,
          dailyLossEth: current.dailyLossEth + additionalLoss,
          consecutiveFailures: receipt?.status === 1 ? 0 : current.consecutiveFailures + 1,
        };
      },
      input.baseDir,
    );

    appendTxLog(
      {
        ts: sentAt,
        chainId: input.plan.chainId,
        reportHash: input.plan.reportHash,
        opportunityId: input.plan.opportunityId,
        txHash: response.hash,
        to: input.plan.to,
        txValueEth,
        policyValueEth: input.plan.valueEth,
        gasUsed: gasUsed.toString(),
        gasPriceWei: effectiveGasPrice.toString(),
        receiptStatus: receipt?.status ?? null,
        status: receipt?.status === 1 ? "sent" : "error",
      },
      input.baseDir,
    );

    if (receipt?.status !== 1) {
      return {
        status: "error",
        reason: "TRANSACTION_REVERTED",
        txHash: response.hash,
        lastTradeAt: updated.lastTradeAt,
      };
    }

    return {
      status: "sent",
      txHash: response.hash,
      lastTradeAt: updated.lastTradeAt,
    };
  } catch (error) {
    const sanitized = sanitizeErrorMessage(error);
    const updated = updateExecutionPolicyState(
      (current) => ({
        ...current,
        consecutiveFailures: current.consecutiveFailures + 1,
      }),
      input.baseDir,
    );
    appendTxLog(
      {
        ts: new Date().toISOString(),
        chainId: input.plan.chainId,
        reportHash: input.plan.reportHash,
        opportunityId: input.plan.opportunityId,
        status: "error",
        reason: sanitized,
        to: input.plan.to,
      },
      input.baseDir,
    );
    return {
      status: "error",
      reason: sanitized,
      lastTradeAt: updated.lastTradeAt,
    };
  }
};
