import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import { buildSubscriptionMessage, verifySubscriptionSignature } from "../src/subscriptions/subscriptionAuth";
import type { SubscriptionUnsigned } from "../src/subscriptions/types";

describe("subscriptionAuth", () => {
  it("verifies a valid subscription signature", async () => {
    const wallet = Wallet.createRandom();
    const unsigned: SubscriptionUnsigned = {
      version: 1,
      userAddress: wallet.address,
      createdAt: 1_771_521_888,
      minNetProfitEth: 0.02,
      maxSlippagePercent: 0.015,
      chains: [42161, 8453],
      pairs: ["WETH/USDC", "WETH/DAI"],
      delivery: {
        webhookUrl: "https://alerts.example.com/hooks/1",
      },
      nonce: "sub_nonce_001",
    };

    const message = buildSubscriptionMessage(unsigned);
    const signature = await wallet.signMessage(message);

    expect(
      verifySubscriptionSignature({
        ...unsigned,
        signature,
      }),
    ).toBe(true);
  });

  it("fails verification when subscription payload changes", async () => {
    const wallet = Wallet.createRandom();
    const unsigned: SubscriptionUnsigned = {
      version: 1,
      userAddress: wallet.address,
      createdAt: 1_771_521_888,
      minNetProfitEth: 0.02,
      maxSlippagePercent: 0.015,
      chains: [8453],
      delivery: {},
      nonce: "sub_nonce_002",
    };

    const signature = await wallet.signMessage(buildSubscriptionMessage(unsigned));
    expect(
      verifySubscriptionSignature({
        ...unsigned,
        minNetProfitEth: 0.03,
        signature,
      }),
    ).toBe(false);
  });
});
