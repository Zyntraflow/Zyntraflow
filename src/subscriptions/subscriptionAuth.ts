import { getAddress, verifyMessage } from "ethers";
import type { Subscription, SubscriptionUnsigned } from "./types";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const canonicalize = (value: JsonValue): JsonValue => {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  const output: Record<string, JsonValue> = {};
  for (const [key, entry] of entries) {
    output[key] = canonicalize(entry);
  }
  return output;
};

const normalizePairs = (pairs?: string[]): string[] | undefined => {
  if (!pairs || pairs.length === 0) {
    return undefined;
  }

  return Array.from(
    new Set(
      pairs
        .map((pair) => pair.trim().toUpperCase())
        .filter((pair) => pair.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
};

const normalizeUnsigned = (subscription: SubscriptionUnsigned): SubscriptionUnsigned => {
  return {
    ...subscription,
    userAddress: getAddress(subscription.userAddress),
    chains: Array.from(new Set(subscription.chains)).sort((left, right) => left - right),
    pairs: normalizePairs(subscription.pairs),
    delivery: {
      webhookUrl: subscription.delivery.webhookUrl?.trim() || undefined,
    },
    nonce: subscription.nonce.trim(),
  };
};

export const buildSubscriptionMessage = (subscription: SubscriptionUnsigned): string => {
  const normalized = normalizeUnsigned(subscription);
  const canonicalPayload = canonicalize(normalized as unknown as JsonValue);
  return [
    "Zyntraflow Subscription Authorization",
    "Read-only alert subscription update.",
    JSON.stringify(canonicalPayload),
  ].join("\n");
};

export const verifySubscriptionSignature = (subscription: Subscription): boolean => {
  try {
    const unsigned: SubscriptionUnsigned = {
      version: subscription.version,
      userAddress: subscription.userAddress,
      createdAt: subscription.createdAt,
      minNetProfitEth: subscription.minNetProfitEth,
      maxSlippagePercent: subscription.maxSlippagePercent,
      chains: subscription.chains,
      pairs: subscription.pairs,
      delivery: subscription.delivery,
      nonce: subscription.nonce,
    };
    const message = buildSubscriptionMessage(unsigned);
    const recovered = verifyMessage(message, subscription.signature);
    return getAddress(recovered) === getAddress(subscription.userAddress);
  } catch {
    return false;
  }
};
