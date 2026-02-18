import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { checkAndConsumePremiumRateLimit } from "../src/premium/rateLimit";

const wallet = "0x000000000000000000000000000000000000dEaD";

const createTempDir = (): string => {
  return fs.mkdtempSync(path.join(os.tmpdir(), "zyntraflow-rate-limit-"));
};

describe("premium rate limit", () => {
  it("allows up to max requests in a window", () => {
    const baseDir = createTempDir();
    const first = checkAndConsumePremiumRateLimit({
      walletAddress: wallet,
      maxPackagesPerHour: 2,
      windowSeconds: 3600,
      baseDir,
      nowUnixSeconds: 1000,
    });
    const second = checkAndConsumePremiumRateLimit({
      walletAddress: wallet,
      maxPackagesPerHour: 2,
      windowSeconds: 3600,
      baseDir,
      nowUnixSeconds: 1001,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it("blocks once max is exceeded", () => {
    const baseDir = createTempDir();
    checkAndConsumePremiumRateLimit({
      walletAddress: wallet,
      maxPackagesPerHour: 1,
      windowSeconds: 60,
      baseDir,
      nowUnixSeconds: 2000,
    });
    const blocked = checkAndConsumePremiumRateLimit({
      walletAddress: wallet,
      maxPackagesPerHour: 1,
      windowSeconds: 60,
      baseDir,
      nowUnixSeconds: 2001,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const baseDir = createTempDir();
    checkAndConsumePremiumRateLimit({
      walletAddress: wallet,
      maxPackagesPerHour: 1,
      windowSeconds: 10,
      baseDir,
      nowUnixSeconds: 3000,
    });
    const allowedAfterReset = checkAndConsumePremiumRateLimit({
      walletAddress: wallet,
      maxPackagesPerHour: 1,
      windowSeconds: 10,
      baseDir,
      nowUnixSeconds: 3011,
    });

    expect(allowedAfterReset.allowed).toBe(true);
    expect(allowedAfterReset.state.count).toBe(1);
  });
});
