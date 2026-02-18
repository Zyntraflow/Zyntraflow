import { keccak256, toUtf8Bytes } from "ethers";

type CanonicalJsonValue =
  | null
  | string
  | number
  | boolean
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

const canonicalizeValue = (value: unknown): CanonicalJsonValue => {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString(10);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeValue(entry));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => {
      return left.localeCompare(right);
    });
    const result: Record<string, CanonicalJsonValue> = {};
    for (const [key, entry] of entries) {
      result[key] = canonicalizeValue(entry);
    }
    return result;
  }

  return String(value);
};

export const canonicalizeJson = (value: object): string => {
  return JSON.stringify(canonicalizeValue(value));
};

export const computeReportHash = (report: object): string => {
  const canonical = canonicalizeJson(report);
  return keccak256(toUtf8Bytes(canonical));
};
