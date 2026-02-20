import { afterEach, describe, expect, it } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { readReadiness, writeReadiness } from "../src/operator/readiness";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zyntraflow-readiness-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("operator readiness", () => {
  it("writes and reads readiness snapshots", () => {
    const dir = makeTempDir();
    const snapshot = writeReadiness(
      {
        lastTickOk: true,
        lastReportHash: "0x" + "a".repeat(64),
        chainsScanned: 2,
        profileId: "base_premium",
        consecutiveFailures: 0,
        lastBackoffMs: 0,
        lastRestartAt: null,
      },
      dir,
    );

    const loaded = readReadiness(dir);
    expect(loaded.lastTickOk).toBe(true);
    expect(loaded.lastReportHash).toBe(snapshot.lastReportHash);
    expect(loaded.chainsScanned).toBe(2);
    expect(loaded.profileId).toBe("base_premium");
    expect(loaded.consecutiveFailures).toBe(0);
    expect(loaded.lastBackoffMs).toBe(0);
    expect(loaded.lastRestartAt).toBeNull();
  });

  it("preserves previous report hash on failed tick update", () => {
    const dir = makeTempDir();
    writeReadiness(
      {
        lastTickOk: true,
        lastReportHash: "0x" + "b".repeat(64),
        chainsScanned: 1,
        profileId: "arb_free",
        consecutiveFailures: 0,
        lastBackoffMs: 0,
      },
      dir,
    );
    writeReadiness(
      {
        lastTickOk: false,
        chainsScanned: 0,
        consecutiveFailures: 2,
        lastBackoffMs: 2000,
        lastRestartAt: new Date(0).toISOString(),
      },
      dir,
    );

    const loaded = readReadiness(dir);
    expect(loaded.lastTickOk).toBe(false);
    expect(loaded.lastReportHash).toBe("0x" + "b".repeat(64));
    expect(loaded.consecutiveFailures).toBe(2);
    expect(loaded.lastBackoffMs).toBe(2000);
    expect(loaded.lastRestartAt).toBe(new Date(0).toISOString());
  });
});
