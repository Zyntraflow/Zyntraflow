import { parseEther } from "ethers";
import type { RpcProviderClient } from "../rpc/manager";
import { retry, withTimeout } from "../rpc/safeCall";
import type { ExecutionPlan, ExecutionSimulationResult } from "./types";

type SimulateOptions = {
  timeoutMs?: number;
  retryMax?: number;
  retryBackoffMs?: number;
};

const sanitizeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/v2\/)([^/\s?#]+)/gi, "$1[REDACTED]")
    .replace(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, "[REDACTED_HEX_64]");
};

export const simulateTransaction = async (
  provider: RpcProviderClient,
  plan: ExecutionPlan,
  options?: SimulateOptions,
): Promise<ExecutionSimulationResult> => {
  if (typeof provider.call !== "function" || typeof provider.estimateGas !== "function") {
    return {
      ok: false,
      error: "Provider does not support transaction simulation methods.",
    };
  }

  const timeoutMs = options?.timeoutMs ?? 8000;
  const retryMax = options?.retryMax ?? 2;
  const retryBackoffMs = options?.retryBackoffMs ?? 250;
  const value = parseEther(plan.valueEth.toString());
  const txRequest = {
    to: plan.to,
    data: plan.data,
    value,
  };

  try {
    await retry(
      async () =>
        withTimeout(
          provider.call(txRequest),
          timeoutMs,
          "Transaction simulation eth_call timed out",
        ),
      {
        max: retryMax,
        backoffMs: retryBackoffMs,
        jitterMs: 120,
      },
    );

    const gasEstimate = await retry(
      async () =>
        withTimeout(
          provider.estimateGas(txRequest),
          timeoutMs,
          "Transaction simulation estimateGas timed out",
        ),
      {
        max: retryMax,
        backoffMs: retryBackoffMs,
        jitterMs: 120,
      },
    );

    return {
      ok: true,
      gasEstimate,
    };
  } catch (error) {
    return {
      ok: false,
      error: sanitizeErrorMessage(error),
    };
  }
};
