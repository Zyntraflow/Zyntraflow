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
      },
      dir,
    );

    const loaded = readReadiness(dir);
    expect(loaded.lastTickOk).toBe(true);
    expect(loaded.lastReportHash).toBe(snapshot.lastReportHash);
    expect(loaded.chainsScanned).toBe(2);
    expect(loaded.profileId).toBe("base_premium");
  });

  it("preserves previous report hash on failed tick update", () => {
    const dir = makeTempDir();
    writeReadiness(
      {
        lastTickOk: true,
        lastReportHash: "0x" + "b".repeat(64),
        chainsScanned: 1,
        profileId: "arb_free",
      },
      dir,
    );
    writeReadiness(
      {
        lastTickOk: false,
        chainsScanned: 0,
      },
      dir,
    );

    const loaded = readReadiness(dir);
    expect(loaded.lastTickOk).toBe(false);
    expect(loaded.lastReportHash).toBe("0x" + "b".repeat(64));
  });
});
