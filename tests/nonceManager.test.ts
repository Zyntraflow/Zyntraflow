import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nonceStatePath, reserveNextNonce } from "../src/execution/nonceManager";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zyntraflow-nonce-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("execution nonce manager", () => {
  it("reserves sequential nonces without collisions", async () => {
    const dir = makeTempDir();
    const provider = {
      getTransactionCount: vi.fn().mockResolvedValue(11),
    };
    const address = "0x000000000000000000000000000000000000dEaD";

    const first = await reserveNextNonce(provider as never, 8453, address, dir);
    const second = await reserveNextNonce(provider as never, 8453, address, dir);

    expect(first).toBe(11);
    expect(second).toBe(12);
    expect(provider.getTransactionCount).toHaveBeenCalledTimes(2);
  });

  it("stores state in reports/execution/nonce.json", async () => {
    const dir = makeTempDir();
    const provider = {
      getTransactionCount: vi.fn().mockResolvedValue(5),
    };
    await reserveNextNonce(provider as never, 8453, "0x000000000000000000000000000000000000beef", dir);
    const filePath = nonceStatePath(dir);

    expect(fs.existsSync(filePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(filePath, "utf8")) as { entries: Record<string, { nextNonce: number }> };
    const key = "8453:0x000000000000000000000000000000000000beef";
    expect(content.entries[key].nextNonce).toBe(6);
  });
});
