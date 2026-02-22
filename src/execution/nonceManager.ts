import fs from "fs";
import path from "path";
import type { RpcProviderClient } from "../rpc/manager";

type NonceEntry = {
  nextNonce: number;
  updatedAt: string;
};

type NonceState = {
  updatedAt: string;
  entries: Record<string, NonceEntry>;
};

const NONCE_FILE = path.join("reports", "execution", "nonce.json");

const defaultState = (): NonceState => ({
  updatedAt: new Date().toISOString(),
  entries: {},
});

const resolveNoncePath = (baseDir = process.cwd()): string => path.join(baseDir, NONCE_FILE);

const readNonceState = (baseDir = process.cwd()): NonceState => {
  const filePath = resolveNoncePath(baseDir);
  if (!fs.existsSync(filePath)) {
    return defaultState();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<NonceState>;
    const entries: Record<string, NonceEntry> = {};
    if (parsed.entries && typeof parsed.entries === "object" && !Array.isArray(parsed.entries)) {
      for (const [key, value] of Object.entries(parsed.entries as Record<string, Partial<NonceEntry>>)) {
        const nextNonce = Number(value.nextNonce);
        if (!Number.isInteger(nextNonce) || nextNonce < 0) {
          continue;
        }
        entries[key] = {
          nextNonce,
          updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
        };
      }
    }
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      entries,
    };
  } catch {
    return defaultState();
  }
};

const writeNonceState = (state: NonceState, baseDir = process.cwd()): void => {
  const filePath = resolveNoncePath(baseDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8" });
  fs.renameSync(tmp, filePath);
};

const nonceKey = (chainId: number, address: string): string => `${chainId}:${address.toLowerCase()}`;

export const reserveNextNonce = async (
  provider: RpcProviderClient,
  chainId: number,
  address: string,
  baseDir = process.cwd(),
): Promise<number> => {
  if (typeof provider.getTransactionCount !== "function") {
    throw new Error("Provider does not support getTransactionCount for nonce reservation.");
  }

  const state = readNonceState(baseDir);
  const key = nonceKey(chainId, address);
  const current = state.entries[key];
  const onChainPending = await provider.getTransactionCount(address, "pending");
  const nextNonce = Math.max(onChainPending, (current?.nextNonce ?? -1) + 1);
  state.entries[key] = {
    nextNonce,
    updatedAt: new Date().toISOString(),
  };
  state.updatedAt = new Date().toISOString();
  writeNonceState(state, baseDir);
  return nextNonce;
};

export const getNextNonce = reserveNextNonce;

export const updateNonce = (
  chainId: number,
  address: string,
  nonce: number,
  baseDir = process.cwd(),
): void => {
  if (!Number.isInteger(nonce) || nonce < 0) {
    return;
  }

  const state = readNonceState(baseDir);
  const key = nonceKey(chainId, address);
  const current = state.entries[key];
  if (current && current.nextNonce > nonce) {
    state.updatedAt = new Date().toISOString();
    writeNonceState(state, baseDir);
    return;
  }
  state.entries[key] = {
    nextNonce: nonce,
    updatedAt: new Date().toISOString(),
  };
  state.updatedAt = new Date().toISOString();
  writeNonceState(state, baseDir);
};

export const clearNonceCacheEntry = (chainId: number, address: string, baseDir = process.cwd()): void => {
  const state = readNonceState(baseDir);
  delete state.entries[nonceKey(chainId, address)];
  state.updatedAt = new Date().toISOString();
  writeNonceState(state, baseDir);
};

export const nonceStatePath = (baseDir = process.cwd()): string => resolveNoncePath(baseDir);
