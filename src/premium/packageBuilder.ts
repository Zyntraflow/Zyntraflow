import { randomBytes } from "crypto";
import { getAddress } from "ethers";
import { decryptJson, deriveKeyFromSignature, encryptJson } from "./encryption";
import type { PremiumPackage } from "./packageTypes";
import { signPackage, verifyPackageSignature } from "./signing";

export type BuildPremiumPackageInput = {
  reportObject: unknown;
  reportHash: string;
  userAddress: string;
  chainId: number;
  ttlSeconds: number;
  version: number;
  userSignature: string;
  signingKeyHex: string;
};

const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

export const buildPremiumPackage = async (input: BuildPremiumPackageInput): Promise<PremiumPackage> => {
  if (input.ttlSeconds <= 0) {
    throw new Error("ttlSeconds must be greater than zero.");
  }
  if (input.version <= 0) {
    throw new Error("version must be greater than zero.");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(input.reportHash)) {
    throw new Error("reportHash must be a 0x-prefixed keccak256 hash.");
  }

  const issuedAt = nowInSeconds();
  const expiresAt = issuedAt + input.ttlSeconds;
  const nonce = randomBytes(16).toString("hex");
  const salt = randomBytes(16);
  const normalizedAddress = getAddress(input.userAddress);
  const key = deriveKeyFromSignature(input.userSignature, salt);
  const encrypted = encryptJson(input.reportObject, key);

  const unsigned = {
    header: {
      version: input.version,
      issuedAt,
      expiresAt,
      nonce,
      reportHash: input.reportHash,
      userAddress: normalizedAddress,
      chainId: input.chainId,
    },
    ciphertextBase64: encrypted.ciphertextBase64,
    ivBase64: encrypted.ivBase64,
    saltBase64: Buffer.from(salt).toString("base64"),
    signerAddress: "",
  };

  return signPackage(unsigned, input.signingKeyHex);
};

export const decryptPremiumPackage = (pkg: PremiumPackage, userSignature: string): unknown => {
  const salt = Buffer.from(pkg.saltBase64, "base64");
  const key = deriveKeyFromSignature(userSignature, salt);
  return decryptJson(
    {
      ciphertextBase64: pkg.ciphertextBase64,
      ivBase64: pkg.ivBase64,
    },
    key,
  );
};

export const isPremiumPackageExpired = (pkg: PremiumPackage, nowUnixSeconds: number = nowInSeconds()): boolean => {
  return nowUnixSeconds >= pkg.header.expiresAt;
};

export const isPremiumPackageValid = (
  pkg: PremiumPackage,
  expectedAddress: string,
  expectedChainId: number,
  nowUnixSeconds: number = nowInSeconds(),
): boolean => {
  if (!verifyPackageSignature(pkg)) {
    return false;
  }

  if (isPremiumPackageExpired(pkg, nowUnixSeconds)) {
    return false;
  }

  if (pkg.header.chainId !== expectedChainId) {
    return false;
  }

  return getAddress(pkg.header.userAddress) === getAddress(expectedAddress);
};
