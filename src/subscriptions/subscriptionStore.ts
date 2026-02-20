import { promises as fs } from "fs";
import path from "path";
import { getAddress } from "ethers";
import { buildSubscriptionMessage, verifySubscriptionSignature } from "./subscriptionAuth";
import type { Subscription, SubscriptionUnsigned } from "./types";

const REPORTS_DIR = "reports";
const SUBSCRIPTIONS_DIR = "subscriptions";
const MAX_SUBSCRIPTION_BYTES = 16 * 1024;
const NONCE_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const PAIR_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const SIGNATURE_PATTERN = /^0x[a-fA-F0-9]{130}$/;

const sanitizeWebhookUrl = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
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

  if (normalized.length === 0) {
    return undefined;
  }

  return normalized;
};

export const validateSubscription = (input: Subscription): Subscription => {
  if (input.version !== 1) {
    throw new Error("Subscription version must be 1.");
  }

  const userAddress = getAddress(input.userAddress);

  if (!Number.isInteger(input.createdAt) || input.createdAt <= 0) {
    throw new Error("createdAt must be a positive unix timestamp.");
  }

  if (!Number.isFinite(input.minNetProfitEth) || input.minNetProfitEth < 0) {
    throw new Error("minNetProfitEth must be a non-negative number.");
  }

  if (!Number.isFinite(input.maxSlippagePercent) || input.maxSlippagePercent < 0 || input.maxSlippagePercent > 1) {
    throw new Error("maxSlippagePercent must be between 0 and 1.");
  }

  const chains = Array.from(new Set(input.chains));
  if (chains.length === 0 || chains.some((chainId) => !Number.isInteger(chainId) || chainId <= 0)) {
    throw new Error("chains must include one or more positive integer chain IDs.");
  }

  const pairs = normalizePairs(input.pairs);
  if (pairs && pairs.some((pair) => !PAIR_PATTERN.test(pair))) {
    throw new Error("pairs must use SYMBOL/SYMBOL format.");
  }

  const nonce = input.nonce.trim();
  if (!NONCE_PATTERN.test(nonce)) {
    throw new Error("nonce must be 8-128 chars using [a-zA-Z0-9_-].");
  }

  if (!SIGNATURE_PATTERN.test(input.signature.trim())) {
    throw new Error("signature must be a 65-byte hex signature.");
  }

  const webhookUrl = sanitizeWebhookUrl(input.delivery?.webhookUrl);

  const normalized: Subscription = {
    version: 1,
    userAddress,
    createdAt: input.createdAt,
    minNetProfitEth: input.minNetProfitEth,
    maxSlippagePercent: input.maxSlippagePercent,
    chains: chains.sort((left, right) => left - right),
    pairs,
    delivery: {
      webhookUrl,
    },
    nonce,
    signature: input.signature.trim(),
  };

  const encoded = Buffer.byteLength(JSON.stringify(normalized), "utf8");
  if (encoded > MAX_SUBSCRIPTION_BYTES) {
    throw new Error("subscription payload too large.");
  }

  const unsigned: SubscriptionUnsigned = {
    version: normalized.version,
    userAddress: normalized.userAddress,
    createdAt: normalized.createdAt,
    minNetProfitEth: normalized.minNetProfitEth,
    maxSlippagePercent: normalized.maxSlippagePercent,
    chains: normalized.chains,
    pairs: normalized.pairs,
    delivery: normalized.delivery,
    nonce: normalized.nonce,
  };
  if (!verifySubscriptionSignature(normalized)) {
    throw new Error("subscription signature verification failed.");
  }
  if (buildSubscriptionMessage(unsigned).length > MAX_SUBSCRIPTION_BYTES) {
    throw new Error("subscription message too large.");
  }

  return normalized;
};

const resolveStorageDir = (baseDir: string): string => path.join(baseDir, REPORTS_DIR, SUBSCRIPTIONS_DIR);

const resolveStoragePath = (baseDir: string, userAddress: string): string => {
  const normalizedAddress = getAddress(userAddress).toLowerCase();
  return path.join(resolveStorageDir(baseDir), `${normalizedAddress}.json`);
};

export const saveSubscription = async (
  input: Subscription,
  options?: { baseDir?: string },
): Promise<{ filePath: string; subscription: Subscription }> => {
  const baseDir = options?.baseDir ?? process.cwd();
  const subscription = validateSubscription(input);
  const filePath = resolveStoragePath(baseDir, subscription.userAddress);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(subscription, null, 2)}\n`, { encoding: "utf8" });
  return { filePath, subscription };
};

export const getSubscription = async (
  userAddress: string,
  options?: { baseDir?: string },
): Promise<Subscription | null> => {
  const baseDir = options?.baseDir ?? process.cwd();
  const filePath = resolveStoragePath(baseDir, userAddress);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return validateSubscription(JSON.parse(raw) as Subscription);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
};

export const listSubscriptions = async (options?: { baseDir?: string }): Promise<Subscription[]> => {
  const baseDir = options?.baseDir ?? process.cwd();
  const dir = resolveStorageDir(baseDir);
  try {
    const files = await fs.readdir(dir);
    const subscriptions = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          try {
            const raw = await fs.readFile(path.join(dir, file), "utf8");
            return validateSubscription(JSON.parse(raw) as Subscription);
          } catch {
            return null;
          }
        }),
    );
    return subscriptions.filter((subscription): subscription is Subscription => subscription !== null);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};
