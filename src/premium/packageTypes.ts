export type PremiumPackageHeader = {
  version: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  reportHash: string;
  userAddress: string;
  chainId: number;
};

export type PremiumPackage = {
  header: PremiumPackageHeader;
  ciphertextBase64: string;
  ivBase64: string;
  saltBase64: string;
  signerAddress: string;
  signature: string;
};
