import fs from "fs";
import path from "path";

export type OperatorReadiness = {
  ts: string;
  lastTickOk: boolean;
  lastReportHash: string | null;
  chainsScanned: number;
  profileId: string;
};

const DEFAULT_READINESS: OperatorReadiness = {
  ts: new Date(0).toISOString(),
  lastTickOk: false,
  lastReportHash: null,
  chainsScanned: 0,
  profileId: "unknown",
};

const sanitizeReportHash = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  return /^0x[a-fA-F0-9]{64}$/.test(value) ? value : null;
};

const resolveReadinessPath = (baseDir: string): string => {
  return path.join(baseDir, "reports", "readiness.json");
};

export const readReadiness = (baseDir: string = process.cwd()): OperatorReadiness => {
  const filePath = resolveReadinessPath(baseDir);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<OperatorReadiness>;
    return {
      ts: typeof parsed.ts === "string" ? parsed.ts : DEFAULT_READINESS.ts,
      lastTickOk: Boolean(parsed.lastTickOk),
      lastReportHash: sanitizeReportHash(parsed.lastReportHash) ?? null,
      chainsScanned:
        typeof parsed.chainsScanned === "number" && Number.isInteger(parsed.chainsScanned) && parsed.chainsScanned >= 0
          ? parsed.chainsScanned
          : 0,
      profileId: typeof parsed.profileId === "string" && parsed.profileId.trim() !== "" ? parsed.profileId : "unknown",
    };
  } catch {
    return { ...DEFAULT_READINESS };
  }
};

export const writeReadiness = (
  input: Partial<OperatorReadiness>,
  baseDir: string = process.cwd(),
): OperatorReadiness => {
  const previous = readReadiness(baseDir);
  const next: OperatorReadiness = {
    ts: new Date().toISOString(),
    lastTickOk: input.lastTickOk ?? previous.lastTickOk,
    lastReportHash: sanitizeReportHash(input.lastReportHash) ?? previous.lastReportHash,
    chainsScanned:
      typeof input.chainsScanned === "number" && Number.isInteger(input.chainsScanned) && input.chainsScanned >= 0
        ? input.chainsScanned
        : previous.chainsScanned,
    profileId: typeof input.profileId === "string" && input.profileId.trim() !== "" ? input.profileId : previous.profileId,
  };

  const filePath = resolveReadinessPath(baseDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8" });
  return next;
};
