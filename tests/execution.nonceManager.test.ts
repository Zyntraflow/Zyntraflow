import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getNextNonce, nonceStatePath, updateNonce } from "../src/execution/nonceManager";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zyntraflow-execution-nonce-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("execution nonce manager", () => {
  it("returns sequential nonces and persists state", async () => {
    const dir = makeTempDir();
    const provider = {
      getTransactionCount: vi.fn().mockResolvedValue(11),
    };
    const address = "0x000000000000000000000000000000000000dEaD";

    const first = await getNextNonce(provider as never, 8453, address, dir);
    updateNonce(8453, address, first, dir);
    const second = await getNextNonce(provider as never, 8453, address, dir);

    expect(first).toBe(11);
    expect(second).toBe(12);
    expect(provider.getTransactionCount).toHaveBeenCalledTimes(2);
    expect(fs.existsSync(nonceStatePath(dir))).toBe(true);
  });

  it("stores used nonce in reports/execution/nonce.json", async () => {
    const dir = makeTempDir();
    const provider = {
      getTransactionCount: vi.fn().mockResolvedValue(5),
    };
    const address = "0x000000000000000000000000000000000000beef";
    const nonce = await getNextNonce(provider as never, 8453, address, dir);
    updateNonce(8453, address, nonce, dir);
    const filePath = nonceStatePath(dir);

    const content = JSON.parse(fs.readFileSync(filePath, "utf8")) as { entries: Record<string, { nextNonce: number }> };
    const key = "8453:0x000000000000000000000000000000000000beef";
    expect(content.entries[key].nextNonce).toBe(5);
  });
});
