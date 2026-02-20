import { getAddress, verifyMessage } from "ethers";

export type Subscription = {
  version: 1;
  userAddress: string;
  createdAt: number;
  minNetProfitEth: number;
  maxSlippagePercent: number;
  chains: number[];
  pairs?: string[];
  delivery: {
    webhookUrl?: string;
  };
  nonce: string;
  signature: string;
};

export type SubscriptionUnsigned = Omit<Subscription, "signature">;

const PAIR_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const NONCE_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const SIGNATURE_PATTERN = /^0x[a-fA-F0-9]{130}$/;

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

  const normalized = Array.from(
    new Set(
      pairs
        .map((pair) => pair.trim().toUpperCase())
        .filter((pair) => pair.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
  return normalized.length > 0 ? normalized : undefined;
};

const sanitizeWebhookUrl = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("delivery.webhookUrl must be a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("delivery.webhookUrl must use HTTPS.");
  }
  return parsed.toString();
};

export const normalizeUnsignedSubscription = (subscription: SubscriptionUnsigned): SubscriptionUnsigned => {
  const userAddress = getAddress(subscription.userAddress);
  const chains = Array.from(new Set(subscription.chains)).sort((left, right) => left - right);
  if (chains.length === 0 || chains.some((chainId) => !Number.isInteger(chainId) || chainId <= 0)) {
    throw new Error("chains must include positive integer chain IDs.");
  }

  if (!Number.isInteger(subscription.createdAt) || subscription.createdAt <= 0) {
    throw new Error("createdAt must be a positive unix timestamp.");
  }
  if (!Number.isFinite(subscription.minNetProfitEth) || subscription.minNetProfitEth < 0) {
    throw new Error("minNetProfitEth must be a non-negative number.");
  }
  if (
    !Number.isFinite(subscription.maxSlippagePercent) ||
    subscription.maxSlippagePercent < 0 ||
    subscription.maxSlippagePercent > 1
  ) {
    throw new Error("maxSlippagePercent must be between 0 and 1.");
  }

  const pairs = normalizePairs(subscription.pairs);
  if (pairs && pairs.some((pair) => !PAIR_PATTERN.test(pair))) {
    throw new Error("pairs must use SYMBOL/SYMBOL format.");
  }

  const nonce = subscription.nonce.trim();
  if (!NONCE_PATTERN.test(nonce)) {
    throw new Error("nonce must be 8-128 chars using [a-zA-Z0-9_-].");
  }

  return {
    version: 1,
    userAddress,
    createdAt: subscription.createdAt,
    minNetProfitEth: subscription.minNetProfitEth,
    maxSlippagePercent: subscription.maxSlippagePercent,
    chains,
    pairs,
    delivery: {
      webhookUrl: sanitizeWebhookUrl(subscription.delivery.webhookUrl),
    },
    nonce,
  };
};

export const buildSubscriptionMessage = (subscription: SubscriptionUnsigned): string => {
  const normalized = normalizeUnsignedSubscription(subscription);
  const canonical = canonicalize(normalized as unknown as JsonValue);
  return [
    "Zyntraflow Subscription Authorization",
    "Read-only alert subscription update.",
    JSON.stringify(canonical),
  ].join("\n");
};

export const verifySubscriptionSignature = (subscription: Subscription): boolean => {
  if (!SIGNATURE_PATTERN.test(subscription.signature.trim())) {
    return false;
  }

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
    const recovered = verifyMessage(message, subscription.signature.trim());
    return getAddress(recovered) === getAddress(subscription.userAddress);
  } catch {
    return false;
  }
};

export const validateSignedSubscription = (input: Subscription): Subscription => {
  if (input.version !== 1) {
    throw new Error("Subscription version must be 1.");
  }

  const unsigned = normalizeUnsignedSubscription({
    version: 1,
    userAddress: input.userAddress,
    createdAt: input.createdAt,
    minNetProfitEth: input.minNetProfitEth,
    maxSlippagePercent: input.maxSlippagePercent,
    chains: input.chains,
    pairs: input.pairs,
    delivery: input.delivery,
    nonce: input.nonce,
  });

  const signature = input.signature.trim();
  const normalized: Subscription = {
    ...unsigned,
    signature,
  };

  if (!verifySubscriptionSignature(normalized)) {
    throw new Error("subscription signature verification failed.");
  }

  return normalized;
};
