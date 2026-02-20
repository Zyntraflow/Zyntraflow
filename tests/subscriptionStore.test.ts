import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Wallet } from "ethers";
import { afterEach, describe, expect, it } from "vitest";
import { buildSubscriptionMessage } from "../src/subscriptions/subscriptionAuth";
import { getSubscription, listSubscriptions, saveSubscription } from "../src/subscriptions/subscriptionStore";
import type { SubscriptionUnsigned } from "../src/subscriptions/types";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zyntraflow-subscriptions-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

const createSignedSubscription = async (
  wallet: { address: string; signMessage: (message: string) => Promise<string> },
  overrides?: Partial<SubscriptionUnsigned>,
) => {
  const unsigned: SubscriptionUnsigned = {
    version: 1,
    userAddress: wallet.address,
    createdAt: 1_771_521_900,
    minNetProfitEth: 0.02,
    maxSlippagePercent: 0.02,
    chains: [8453],
    pairs: ["WETH/USDC"],
    delivery: {
      webhookUrl: "https://alerts.example.com/hook",
    },
    nonce: "subscription_nonce",
    ...overrides,
  };

  const signature = await wallet.signMessage(buildSubscriptionMessage(unsigned));
  return { ...unsigned, signature };
};

describe("subscriptionStore", () => {
  it("stores and reads a verified subscription", async () => {
    const baseDir = await createTempDir();
    const wallet = Wallet.createRandom();
    const subscription = await createSignedSubscription(wallet);

    const result = await saveSubscription(subscription, { baseDir });
    expect(result.filePath).toContain(path.join("reports", "subscriptions"));

    const loaded = await getSubscription(wallet.address, { baseDir });
    expect(loaded).not.toBeNull();
    expect(loaded?.userAddress.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  it("overwrites by address instead of creating duplicates", async () => {
    const baseDir = await createTempDir();
    const wallet = Wallet.createRandom();

    const first = await createSignedSubscription(wallet, { minNetProfitEth: 0.03, nonce: "nonce_first" });
    await saveSubscription(first, { baseDir });

    const second = await createSignedSubscription(wallet, { minNetProfitEth: 0.04, nonce: "nonce_second" });
    await saveSubscription(second, { baseDir });

    const all = await listSubscriptions({ baseDir });
    expect(all).toHaveLength(1);
    expect(all[0].minNetProfitEth).toBe(0.04);
    expect(all[0].nonce).toBe("nonce_second");
  });

  it("rejects invalid signatures", async () => {
    const baseDir = await createTempDir();
    const wallet = Wallet.createRandom();
    const other = Wallet.createRandom();
    const unsigned: SubscriptionUnsigned = {
      version: 1,
      userAddress: wallet.address,
      createdAt: 1_771_521_900,
      minNetProfitEth: 0.02,
      maxSlippagePercent: 0.02,
      chains: [8453],
      delivery: {},
      nonce: "nonce_invalid",
    };

    const signature = await other.signMessage(buildSubscriptionMessage(unsigned));
    await expect(saveSubscription({ ...unsigned, signature }, { baseDir })).rejects.toThrow(
      "subscription signature verification failed",
    );
  });
});
