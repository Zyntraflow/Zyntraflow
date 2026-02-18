import fs from "fs";
import path from "path";
import { getAddress } from "ethers";
import type { PremiumPackage } from "./packageTypes";
import type { SignedFreeSummary } from "../reporting/freeSummarySigned";

const writeJsonNoOverwrite = (filePath: string, payload: unknown): string => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { encoding: "utf8", flag: "wx" });
    return filePath;
  }

  const ext = path.extname(filePath);
  const base = filePath.slice(0, filePath.length - ext.length);
  let suffix = 1;
  let candidate = `${base}-${suffix}${ext}`;
  while (fs.existsSync(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}${ext}`;
  }
  fs.writeFileSync(candidate, JSON.stringify(payload, null, 2), { encoding: "utf8", flag: "wx" });
  return candidate;
};

const dateSegment = (date: Date): string => date.toISOString().slice(0, 10);

const writeSignedSummaryAtRoot = (
  signed: SignedFreeSummary,
  root: string,
  now: Date,
): { latestPath: string; historyPath: string } => {
  const feedDir = path.join(root, "public-feed");
  const historyDir = path.join(feedDir, "history");
  const latestPath = path.join(feedDir, "latest.signed.json");
  const historyPath = path.join(historyDir, `${dateSegment(now)}.jsonl`);
  fs.mkdirSync(historyDir, { recursive: true });
  const serialized = JSON.stringify(signed);
  fs.writeFileSync(latestPath, `${serialized}\n`, { encoding: "utf8" });
  fs.appendFileSync(historyPath, `${serialized}\n`, { encoding: "utf8" });
  return { latestPath, historyPath };
};

export const storePremiumPackage = (
  pkg: PremiumPackage,
  reportHash: string,
  userAddress: string,
  options?: { baseDir?: string },
): string => {
  const baseDir = options?.baseDir ?? process.cwd();
  if (!/^0x[a-fA-F0-9]{64}$/.test(reportHash)) {
    throw new Error("Invalid reportHash format.");
  }
  const normalizedAddress = getAddress(userAddress).toLowerCase();
  const targetPath = path.join(baseDir, "reports", "premium", reportHash, `${normalizedAddress}.json`);
  return writeJsonNoOverwrite(targetPath, pkg);
};

export const storeSignedFreeSummary = (
  signed: SignedFreeSummary,
  options?: { baseDir?: string; now?: Date; mirrorWebPublic?: boolean },
): { latestPath: string; historyPath: string; mirroredLatestPath?: string; mirroredHistoryPath?: string } => {
  const baseDir = options?.baseDir ?? process.cwd();
  const now = options?.now ?? new Date();
  const rootPaths = writeSignedSummaryAtRoot(signed, baseDir, now);

  if (options?.mirrorWebPublic === false) {
    return rootPaths;
  }

  const webPublicDir = path.join(baseDir, "my-smart-wallets-app", "public");
  if (!fs.existsSync(webPublicDir)) {
    return rootPaths;
  }

  const mirrored = writeSignedSummaryAtRoot(signed, webPublicDir, now);
  return {
    ...rootPaths,
    mirroredLatestPath: mirrored.latestPath,
    mirroredHistoryPath: mirrored.historyPath,
  };
};
