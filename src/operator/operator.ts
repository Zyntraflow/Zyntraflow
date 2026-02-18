import { exec } from "child_process";
import dotenv from "dotenv";
import { promisify } from "util";
import { parseCliArgs } from "../cli/args";
import { logger } from "../logger";
import { markTickFailure, markTickStart, markTickSuccess } from "./health";

dotenv.config({ path: ".env.operator", override: false, quiet: true });
dotenv.config({ path: ".env", override: false, quiet: true });

const execAsync = promisify(exec);
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm" : "npm";

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value || value.trim() === "") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const parseNonNegativeInt = (value: string | undefined, fallback: number): number => {
  if (!value || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
};

const delay = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const extractReportHash = (output: string): string | undefined => {
  const jsonMatch = output.match(/"reportHash"\s*:\s*"(0x[a-fA-F0-9]{64})"/);
  if (jsonMatch?.[1]) {
    return jsonMatch[1];
  }

  const textMatch = output.match(/reportHash\s+(0x[a-fA-F0-9]{64})/i);
  return textMatch?.[1];
};

const sanitizeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/v2\/)([^/\s?#]+)/gi, "$1[REDACTED]")
    .replace(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, "[REDACTED_HEX_64]");
};

export const runOnce = async (): Promise<boolean> => {
  markTickStart();

  try {
    const { stdout } = await execAsync(`${npmCommand} run dev -- --operator true`, {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
      shell: isWindows ? process.env.ComSpec ?? "cmd.exe" : "/bin/sh",
    });

    const reportHash = extractReportHash(stdout ?? "");
    markTickSuccess(reportHash);
    process.stdout.write("Operator tick ok\n");
    logger.info({ reportHash }, "Operator tick ok");
    return true;
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    markTickFailure(message);
    logger.error({ error: message }, "Operator tick failed");
    return false;
  }
};

export const runLoop = async (
  intervalSeconds: number,
  maxTicks = 0,
  jitterMs = 0,
  shouldContinue: () => boolean = () => true,
): Promise<void> => {
  let ticks = 0;
  while (shouldContinue()) {
    await runOnce();
    ticks += 1;
    if (maxTicks > 0 && ticks >= maxTicks) {
      return;
    }

    const baseDelay = intervalSeconds * 1000;
    const jitterDelay = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
    await delay(baseDelay + jitterDelay);
  }
};

const main = async (): Promise<void> => {
  const cliArgs = parseCliArgs();
  const operatorEnabled = cliArgs.operatorOverride ?? parseBoolean(process.env.OPERATOR_ENABLE, true);
  const intervalSeconds = cliArgs.intervalOverride ?? parsePositiveInt(process.env.OPERATOR_INTERVAL_SECONDS, 30);
  const maxTicks = parseNonNegativeInt(process.env.OPERATOR_MAX_TICKS, 0);
  const jitterMs = parseNonNegativeInt(process.env.OPERATOR_JITTER_MS, 500);

  if (!operatorEnabled) {
    logger.info("Operator disabled");
    return;
  }

  let shuttingDown = false;
  const requestShutdown = (signal: "SIGINT" | "SIGTERM"): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Operator shutdown requested");
  };

  process.on("SIGINT", () => requestShutdown("SIGINT"));
  process.on("SIGTERM", () => requestShutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ error: sanitizeErrorMessage(reason) }, "Unhandled rejection");
  });
  process.on("uncaughtException", (error) => {
    logger.error({ error: sanitizeErrorMessage(error) }, "Uncaught exception");
  });

  try {
    logger.info({ intervalSeconds, maxTicks, jitterMs }, "Operator loop started");
    process.stdout.write(`Operator loop started (interval=${intervalSeconds}s)\n`);
    await runLoop(intervalSeconds, maxTicks, jitterMs, () => !shuttingDown);
  } finally {
    logger.info("Operator shutdown clean");
    process.stdout.write("Operator shutdown clean\n");
  }
};

if (require.main === module) {
  void main();
}
