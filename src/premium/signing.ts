import { getAddress, verifyMessage, Wallet } from "ethers";
import type { PremiumPackage, PremiumPackageHeader } from "./packageTypes";

type UnsignedPremiumPackage = Omit<PremiumPackage, "signature">;

const canonicalizeHeader = (header: PremiumPackageHeader): Record<string, number | string> => {
  return {
    version: header.version,
    issuedAt: header.issuedAt,
    expiresAt: header.expiresAt,
    nonce: header.nonce,
    reportHash: header.reportHash,
    userAddress: getAddress(header.userAddress),
    chainId: header.chainId,
  };
};

const canonicalizeUnsignedPackage = (pkg: UnsignedPremiumPackage): string => {
  return JSON.stringify({
    header: canonicalizeHeader(pkg.header),
    ciphertextBase64: pkg.ciphertextBase64,
    ivBase64: pkg.ivBase64,
    saltBase64: pkg.saltBase64,
    signerAddress: getAddress(pkg.signerAddress),
  });
};

export const signPackage = async (
  pkgWithoutSignature: UnsignedPremiumPackage,
  signingKeyHex: string,
): Promise<PremiumPackage> => {
  const signer = new Wallet(signingKeyHex);
  const signerAddress = getAddress(signer.address);
  const unsigned: UnsignedPremiumPackage = {
    ...pkgWithoutSignature,
    signerAddress,
  };
  const payload = canonicalizeUnsignedPackage(unsigned);
  const signature = await signer.signMessage(payload);
  return {
    ...unsigned,
    signature,
  };
};

export const verifyPackageSignature = (pkg: PremiumPackage): boolean => {
  try {
    const payload = canonicalizeUnsignedPackage({
      header: pkg.header,
      ciphertextBase64: pkg.ciphertextBase64,
      ivBase64: pkg.ivBase64,
      saltBase64: pkg.saltBase64,
      signerAddress: pkg.signerAddress,
    });
    const recovered = verifyMessage(payload, pkg.signature);
    return getAddress(recovered) === getAddress(pkg.signerAddress);
  } catch {
    return false;
  }
};
