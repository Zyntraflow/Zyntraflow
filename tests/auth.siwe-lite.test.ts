import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import { buildLoginMessage, buildNonce, verifyLoginSignature } from "../src/auth/siwe";

describe("siwe-lite", () => {
  it("verifies a valid signature for expected address", async () => {
    const wallet = Wallet.createRandom();
    const nonce = buildNonce();
    const message = buildLoginMessage(wallet.address, nonce);
    const signature = await wallet.signMessage(message);

    expect(verifyLoginSignature(message, signature, wallet.address)).toBe(true);
  });

  it("fails for mismatched address", async () => {
    const walletA = Wallet.createRandom();
    const walletB = Wallet.createRandom();
    const nonce = buildNonce();
    const message = buildLoginMessage(walletA.address, nonce);
    const signature = await walletA.signMessage(message);

    expect(verifyLoginSignature(message, signature, walletB.address)).toBe(false);
  });
});
