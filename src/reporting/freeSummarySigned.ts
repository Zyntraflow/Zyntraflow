import { getAddress, getBytes, keccak256, toUtf8Bytes, verifyMessage, Wallet } from "ethers";
import type { FreeSummary } from "./freeSummary";
import { canonicalizeJson } from "./reportHash";

export type SignedFreeSummary = {
  summary: FreeSummary;
  signerAddress: string;
  signature: string;
};

const readAppSignerKey = (): string => {
  const envName = ["PREMIUM", "SIGNER", "PRIVATE", "KEY"].join("_");
  const raw = process.env[envName];
  if (!raw || raw.trim() === "") {
    throw new Error(`${envName} is required to sign free summaries.`);
  }
  const normalized = raw.trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error(`${envName} must be a 64-hex private key.`);
  }
  return normalized.startsWith("0x") ? normalized : `0x${normalized}`;
};

const hashFreeSummary = (summary: FreeSummary): string => {
  return keccak256(toUtf8Bytes(canonicalizeJson(summary)));
};

export const signFreeSummary = async (summary: FreeSummary, appSignerKey?: string): Promise<SignedFreeSummary> => {
  const signer = new Wallet(appSignerKey ?? readAppSignerKey());
  const hash = hashFreeSummary(summary);
  const signature = await signer.signMessage(getBytes(hash));
  return {
    summary,
    signerAddress: getAddress(signer.address),
    signature,
  };
};

export const verifyFreeSummary = (signed: SignedFreeSummary): boolean => {
  try {
    const hash = hashFreeSummary(signed.summary);
    const recovered = verifyMessage(getBytes(hash), signed.signature);
    return getAddress(recovered) === getAddress(signed.signerAddress);
  } catch {
    return false;
  }
};
