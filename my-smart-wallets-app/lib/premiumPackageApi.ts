export type PremiumPackageLookup = {
  reportHash: string;
  address: string;
};

const REPORT_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export const validatePremiumLookup = (lookup: PremiumPackageLookup): string | null => {
  if (!REPORT_HASH_PATTERN.test(lookup.reportHash.trim())) {
    return "Report hash must be a 0x-prefixed 64-hex value.";
  }
  if (!ADDRESS_PATTERN.test(lookup.address.trim())) {
    return "Wallet address must be a valid 0x-prefixed 40-hex value.";
  }
  return null;
};

export const buildPremiumPackagePath = (lookup: PremiumPackageLookup): string => {
  return `/api/premium/${lookup.reportHash.trim()}/${lookup.address.trim().toLowerCase()}`;
};

