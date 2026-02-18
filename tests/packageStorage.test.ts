import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { storePremiumPackage, storeSignedFreeSummary } from "../src/premium/packageStorage";
import type { PremiumPackage } from "../src/premium/packageTypes";
import type { SignedFreeSummary } from "../src/reporting/freeSummarySigned";

const makeTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "zyntraflow-storage-"));

const samplePackage: PremiumPackage = {
  header: {
    version: 1,
    issuedAt: 1000,
    expiresAt: 1060,
    nonce: "abc123abc123abc123abc123abc123ab",
    reportHash: "0x" + "11".repeat(32),
    userAddress: "0x000000000000000000000000000000000000dEaD",
    chainId: 1,
  },
  ciphertextBase64: "ZmFrZQ==",
  ivBase64: "aXY=",
  saltBase64: "c2FsdA==",
  signerAddress: "0x000000000000000000000000000000000000dEaD",
  signature: "0x" + "12".repeat(65),
};

const sampleSignedSummary: SignedFreeSummary = {
  summary: {
    ts: 1000,
    chainId: 1,
    rpcName: "primary",
    pairsScanned: 1,
    topOpportunities: [],
    reportHash: "0x" + "11".repeat(32),
    premiumAvailable: false,
  },
  signerAddress: "0x000000000000000000000000000000000000dEaD",
  signature: "0x" + "34".repeat(65),
};

describe("package storage", () => {
  it("stores premium package under reports/premium/reportHash/address.json", () => {
    const baseDir = makeTempDir();
    const storedPath = storePremiumPackage(
      samplePackage,
      samplePackage.header.reportHash,
      samplePackage.header.userAddress,
      { baseDir },
    );

    expect(storedPath).toContain(path.join("reports", "premium", samplePackage.header.reportHash));
    expect(fs.existsSync(storedPath)).toBe(true);
  });

  it("avoids overwrite by suffixing duplicate premium package files", () => {
    const baseDir = makeTempDir();
    const first = storePremiumPackage(samplePackage, samplePackage.header.reportHash, samplePackage.header.userAddress, {
      baseDir,
    });
    const second = storePremiumPackage(samplePackage, samplePackage.header.reportHash, samplePackage.header.userAddress, {
      baseDir,
    });

    expect(first).not.toBe(second);
    expect(second.endsWith(".json")).toBe(true);
  });

  it("stores latest signed summary and appends history", () => {
    const baseDir = makeTempDir();
    const result = storeSignedFreeSummary(sampleSignedSummary, { baseDir, mirrorWebPublic: false, now: new Date("2026-02-18T00:00:00.000Z") });

    expect(fs.existsSync(result.latestPath)).toBe(true);
    expect(fs.existsSync(result.historyPath)).toBe(true);
    const latestRaw = fs.readFileSync(result.latestPath, "utf8").trim();
    expect(JSON.parse(latestRaw)).toEqual(sampleSignedSummary);
  });
});
