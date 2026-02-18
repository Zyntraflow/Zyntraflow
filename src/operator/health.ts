import fs from "fs";
import path from "path";

export type OperatorHealth = {
  timestamp: string;
  lastTickAt: string | null;
  lastTickOk: boolean;
  lastError: string | null;
  lastReportHash: string | null;
};

const healthState: OperatorHealth = {
  timestamp: new Date(0).toISOString(),
  lastTickAt: null,
  lastTickOk: false,
  lastError: null,
  lastReportHash: null,
};

const sanitizeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/v2\/)([^/\s?#]+)/gi, "$1[REDACTED]")
    .replace(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, "[REDACTED_HEX_64]");
};

const writeHealthSnapshot = (baseDir: string, payload: OperatorHealth): void => {
  const feedDir = path.join(baseDir, "public-feed");
  const filePath = path.join(feedDir, "operator-health.json");
  fs.mkdirSync(feedDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { encoding: "utf8" });

  const webPublicDir = path.join(baseDir, "my-smart-wallets-app", "public", "public-feed");
  if (fs.existsSync(path.join(baseDir, "my-smart-wallets-app", "public"))) {
    fs.mkdirSync(webPublicDir, { recursive: true });
    fs.writeFileSync(path.join(webPublicDir, "operator-health.json"), JSON.stringify(payload, null, 2), {
      encoding: "utf8",
    });
  }
};

const persist = (baseDir?: string): void => {
  writeHealthSnapshot(baseDir ?? process.cwd(), healthState);
};

export const markTickStart = (baseDir?: string): void => {
  healthState.timestamp = new Date().toISOString();
  healthState.lastTickAt = healthState.timestamp;
  persist(baseDir);
};

export const markTickSuccess = (reportHash?: string, baseDir?: string): void => {
  healthState.timestamp = new Date().toISOString();
  healthState.lastTickAt = healthState.timestamp;
  healthState.lastTickOk = true;
  healthState.lastError = null;
  if (reportHash) {
    healthState.lastReportHash = reportHash;
  }
  persist(baseDir);
};

export const markTickFailure = (error: unknown, baseDir?: string): void => {
  healthState.timestamp = new Date().toISOString();
  healthState.lastTickAt = healthState.timestamp;
  healthState.lastTickOk = false;
  healthState.lastError = sanitizeError(error);
  persist(baseDir);
};

export const getHealth = (): OperatorHealth => ({ ...healthState });
