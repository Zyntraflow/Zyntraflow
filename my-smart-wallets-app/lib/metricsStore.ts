import { existsSync } from "fs";
import { promises as fs } from "fs";
import path from "path";

export type MetricKey =
  | "feedLatestHits"
  | "feedHistoryHits"
  | "healthHits"
  | "premiumPullHits"
  | "launchPageHits";

export type DailyMetrics = {
  date: string;
  feedLatestHits: number;
  feedHistoryHits: number;
  healthHits: number;
  premiumPullHits: number;
  launchPageHits: number;
};

const writeQueues = new Map<string, Promise<void>>();

const todayDate = (): string => new Date().toISOString().slice(0, 10);

const defaultMetrics = (date: string): DailyMetrics => ({
  date,
  feedLatestHits: 0,
  feedHistoryHits: 0,
  healthHits: 0,
  premiumPullHits: 0,
  launchPageHits: 0,
});

const resolveReportsDir = (): string => {
  const direct = path.join(process.cwd(), "reports");
  const parent = path.join(process.cwd(), "..", "reports");

  if (existsSync(direct)) {
    return direct;
  }

  if (existsSync(parent)) {
    return parent;
  }

  return direct;
};

const metricsFilePath = (date: string): string => {
  return path.join(resolveReportsDir(), "metrics", `${date}.json`);
};

const enqueueWrite = async <T>(filePath: string, task: () => Promise<T>): Promise<T> => {
  const queue = writeQueues.get(filePath) ?? Promise.resolve();
  const run = queue.then(task, task);
  writeQueues.set(
    filePath,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
};

const readMetricsInternal = async (date: string): Promise<DailyMetrics> => {
  const filePath = metricsFilePath(date);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<DailyMetrics>;
    const fallback = defaultMetrics(date);

    return {
      date,
      feedLatestHits: Number.isFinite(parsed.feedLatestHits) ? Number(parsed.feedLatestHits) : fallback.feedLatestHits,
      feedHistoryHits: Number.isFinite(parsed.feedHistoryHits)
        ? Number(parsed.feedHistoryHits)
        : fallback.feedHistoryHits,
      healthHits: Number.isFinite(parsed.healthHits) ? Number(parsed.healthHits) : fallback.healthHits,
      premiumPullHits: Number.isFinite(parsed.premiumPullHits)
        ? Number(parsed.premiumPullHits)
        : fallback.premiumPullHits,
      launchPageHits: Number.isFinite(parsed.launchPageHits)
        ? Number(parsed.launchPageHits)
        : fallback.launchPageHits,
    };
  } catch {
    return defaultMetrics(date);
  }
};

const writeMetricsInternal = async (date: string, payload: DailyMetrics): Promise<void> => {
  const filePath = metricsFilePath(date);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8" });

  try {
    await fs.rename(tmpPath, filePath);
  } catch {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore missing target file.
    }
    await fs.rename(tmpPath, filePath);
  }
};

export const incrementMetricCounter = async (key: MetricKey): Promise<DailyMetrics> => {
  const date = todayDate();
  const filePath = metricsFilePath(date);

  return enqueueWrite(filePath, async () => {
    const current = await readMetricsInternal(date);
    const next: DailyMetrics = {
      ...current,
      [key]: current[key] + 1,
    };
    await writeMetricsInternal(date, next);
    return next;
  });
};

export const readTodayMetrics = async (): Promise<DailyMetrics> => {
  return readMetricsInternal(todayDate());
};

export const isPublicMetricsEnabled = (): boolean => {
  const raw = process.env.ENABLE_PUBLIC_METRICS;
  if (!raw || raw.trim() === "") {
    return false;
  }

  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};
