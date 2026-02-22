import fs from "fs";
import path from "path";
import type { ExecutionPlan } from "./types";

const ATTEMPTS_FILE = path.join("reports", "execution", "attempts.jsonl");
const MAX_ATTEMPT_LINES_SCANNED = 5000;

type ExecutionAttemptRecord = {
  ts: string;
  attemptedAtMs: number;
  reportHash: string;
  opportunityId: string;
  chainId: number;
  status: string;
};

const resolveAttemptsPath = (baseDir = process.cwd()): string => path.join(baseDir, ATTEMPTS_FILE);

const parseAttemptLine = (line: string): ExecutionAttemptRecord | null => {
  if (!line || line.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(line) as Partial<ExecutionAttemptRecord>;
    if (
      typeof parsed.attemptedAtMs !== "number" ||
      !Number.isFinite(parsed.attemptedAtMs) ||
      typeof parsed.reportHash !== "string" ||
      parsed.reportHash.trim() === "" ||
      typeof parsed.opportunityId !== "string" ||
      parsed.opportunityId.trim() === ""
    ) {
      return null;
    }

    return {
      ts: typeof parsed.ts === "string" ? parsed.ts : new Date(parsed.attemptedAtMs).toISOString(),
      attemptedAtMs: parsed.attemptedAtMs,
      reportHash: parsed.reportHash,
      opportunityId: parsed.opportunityId,
      chainId: typeof parsed.chainId === "number" ? parsed.chainId : 0,
      status: typeof parsed.status === "string" ? parsed.status : "attempted",
    };
  } catch {
    return null;
  }
};

export const hasRecentExecutionAttempt = (
  plan: Pick<ExecutionPlan, "reportHash" | "opportunityId">,
  windowSeconds: number,
  baseDir = process.cwd(),
  nowMs = Date.now(),
): boolean => {
  if (windowSeconds <= 0) {
    return false;
  }

  const attemptsPath = resolveAttemptsPath(baseDir);
  if (!fs.existsSync(attemptsPath)) {
    return false;
  }

  try {
    const raw = fs.readFileSync(attemptsPath, "utf8");
    const lines = raw
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "")
      .slice(-MAX_ATTEMPT_LINES_SCANNED);
    const floorMs = nowMs - windowSeconds * 1000;

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const attempt = parseAttemptLine(lines[index]);
      if (!attempt) {
        continue;
      }
      if (attempt.attemptedAtMs < floorMs) {
        continue;
      }
      if (attempt.reportHash === plan.reportHash && attempt.opportunityId === plan.opportunityId) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
};

export const recordExecutionAttempt = (
  plan: Pick<ExecutionPlan, "reportHash" | "opportunityId" | "chainId">,
  status: string,
  baseDir = process.cwd(),
  now = new Date(),
): void => {
  const attemptsPath = resolveAttemptsPath(baseDir);
  fs.mkdirSync(path.dirname(attemptsPath), { recursive: true });
  const entry: ExecutionAttemptRecord = {
    ts: now.toISOString(),
    attemptedAtMs: now.getTime(),
    reportHash: plan.reportHash,
    opportunityId: plan.opportunityId,
    chainId: plan.chainId,
    status,
  };
  fs.appendFileSync(attemptsPath, `${JSON.stringify(entry)}\n`, { encoding: "utf8" });
};

export const executionAttemptsFilePath = (baseDir = process.cwd()): string => resolveAttemptsPath(baseDir);
