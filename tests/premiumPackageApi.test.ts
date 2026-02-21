import { describe, expect, it } from "vitest";
import { buildPremiumPackagePath, validatePremiumLookup } from "../my-smart-wallets-app/lib/premiumPackageApi";

describe("premium package api helpers", () => {
  it("builds lowercase premium package path", () => {
    const path = buildPremiumPackagePath({
      reportHash: "0x" + "a".repeat(64),
      address: "0xAbCdEfabcdefABCDEFabcdefabcdefABCDEFabcd",
    });
    expect(path).toBe(`/api/premium/${"0x" + "a".repeat(64)}/0xabcdefabcdefabcdefabcdefabcdefabcdefabcd`);
  });

  it("validates malformed lookup inputs", () => {
    expect(
      validatePremiumLookup({
        reportHash: "not-a-hash",
        address: "0xabc",
      }),
    ).toContain("Report hash");
    expect(
      validatePremiumLookup({
        reportHash: "0x" + "a".repeat(64),
        address: "0xabc",
      }),
    ).toContain("Wallet address");
  });
});

