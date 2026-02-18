import { randomBytes } from "crypto";
import { getAddress, verifyMessage } from "ethers";

export const buildNonce = (): string => randomBytes(16).toString("hex");

export const buildLoginMessage = (address: string, nonce: string): string => {
  return [
    "Zyntraflow Sign-In",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    "Purpose: verify wallet ownership for read-only premium access",
  ].join("\n");
};

export const verifyLoginSignature = (
  message: string,
  signature: string,
  expectedAddress: string,
): boolean => {
  try {
    const recovered = verifyMessage(message, signature);
    return getAddress(recovered) === getAddress(expectedAddress);
  } catch {
    return false;
  }
};
