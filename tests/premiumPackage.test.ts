import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import { buildLoginMessage, buildNonce } from "../src/auth/siwe";
import {
  buildPremiumPackage,
  decryptPremiumPackage,
  isPremiumPackageExpired,
  isPremiumPackageValid,
} from "../src/premium/packageBuilder";
import { verifyPackageSignature } from "../src/premium/signing";

describe("premium package", () => {
  it("builds an encrypted package that can be verified and decrypted by the signing wallet user", async () => {
    const userWallet = Wallet.createRandom();
    const signerWallet = Wallet.createRandom();
    const nonce = buildNonce();
    const loginMessage = buildLoginMessage(userWallet.address, nonce);
    const userSignature = await userWallet.signMessage(loginMessage);
    const report = {
      opportunities: [{ pair: "WETH/USDC", netProfitEth: 0.017 }],
      source: "dry-run",
    };

    const pkg = await buildPremiumPackage({
      reportObject: report,
      reportHash: "0x" + "11".repeat(32),
      userAddress: userWallet.address,
      chainId: 1,
      ttlSeconds: 60,
      version: 1,
      userSignature,
      signingKeyHex: signerWallet.privateKey,
    });

    expect(pkg.header.userAddress).toBe(userWallet.address);
    expect(pkg.header.chainId).toBe(1);
    expect(pkg.header.reportHash).toBe("0x" + "11".repeat(32));
    expect(pkg.header.expiresAt).toBeGreaterThan(pkg.header.issuedAt);
    expect(pkg.header.nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(verifyPackageSignature(pkg)).toBe(true);
    expect(isPremiumPackageValid(pkg, userWallet.address, 1, pkg.header.issuedAt + 1)).toBe(true);

    const decrypted = decryptPremiumPackage(pkg, userSignature);
    expect(decrypted).toEqual(report);
  });

  it("fails decrypt with the wrong user signature", async () => {
    const userWallet = Wallet.createRandom();
    const wrongWallet = Wallet.createRandom();
    const signerWallet = Wallet.createRandom();
    const nonce = buildNonce();
    const loginMessage = buildLoginMessage(userWallet.address, nonce);
    const validSignature = await userWallet.signMessage(loginMessage);
    const wrongSignature = await wrongWallet.signMessage(loginMessage);

    const pkg = await buildPremiumPackage({
      reportObject: { id: "r1" },
      reportHash: "0x" + "22".repeat(32),
      userAddress: userWallet.address,
      chainId: 42161,
      ttlSeconds: 30,
      version: 1,
      userSignature: validSignature,
      signingKeyHex: signerWallet.privateKey,
    });

    expect(() => decryptPremiumPackage(pkg, wrongSignature)).toThrow();
  });

  it("marks package as expired at or after expiration time", async () => {
    const userWallet = Wallet.createRandom();
    const signerWallet = Wallet.createRandom();
    const nonce = buildNonce();
    const loginMessage = buildLoginMessage(userWallet.address, nonce);
    const userSignature = await userWallet.signMessage(loginMessage);

    const pkg = await buildPremiumPackage({
      reportObject: { id: "r2" },
      reportHash: "0x" + "33".repeat(32),
      userAddress: userWallet.address,
      chainId: 10,
      ttlSeconds: 1,
      version: 1,
      userSignature,
      signingKeyHex: signerWallet.privateKey,
    });

    expect(isPremiumPackageExpired(pkg, pkg.header.expiresAt - 1)).toBe(false);
    expect(isPremiumPackageExpired(pkg, pkg.header.expiresAt)).toBe(true);
    expect(isPremiumPackageValid(pkg, userWallet.address, 10, pkg.header.expiresAt)).toBe(false);
  });
});
