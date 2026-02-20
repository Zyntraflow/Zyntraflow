import "server-only";

import { existsSync } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { getAddress } from "ethers";
import type { Subscription } from "./subscriptionAuth";
import { validateSignedSubscription } from "./subscriptionAuth";

const MAX_SUBSCRIPTION_BYTES = 16 * 1024;

const resolveReportsDir = (): string => {
  const direct = path.join(process.cwd(), "reports");
  const parent = path.join(process.cwd(), "..", "reports");
  if (existsSync(direct)) {
    return direct;
  }
  if (existsSync(parent)) {
    return parent;
  }
  return direct;
};

const subscriptionsDir = (): string => path.join(resolveReportsDir(), "subscriptions");

const subscriptionPath = (address: string): string => {
  const normalized = getAddress(address).toLowerCase();
  return path.join(subscriptionsDir(), `${normalized}.json`);
};

export const saveSubscription = async (input: Subscription): Promise<Subscription> => {
  const normalized = validateSignedSubscription(input);
  const encoded = Buffer.byteLength(JSON.stringify(normalized), "utf8");
  if (encoded > MAX_SUBSCRIPTION_BYTES) {
    throw new Error("subscription payload too large.");
  }

  const filePath = subscriptionPath(normalized.userAddress);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, { encoding: "utf8" });
  return normalized;
};

export const getSubscription = async (address: string): Promise<Subscription | null> => {
  const filePath = subscriptionPath(address);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return validateSignedSubscription(JSON.parse(raw) as Subscription);
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
