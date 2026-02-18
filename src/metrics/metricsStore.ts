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

export type MetricsStoreOptions = {
  baseDir?: string;
  now?: Date;
};

const writeQueues = new Map<string, Promise<void>>();

const dateKey = (now: Date): string => now.toISOString().slice(0, 10);

const defaultMetrics = (date: string): DailyMetrics => ({
  date,
  feedLatestHits: 0,
  feedHistoryHits: 0,
  healthHits: 0,
  premiumPullHits: 0,
  launchPageHits: 0,
});

const resolveReportsDir = (baseDir: string): string => {
  const direct = path.join(baseDir, "reports");
  const parent = path.join(baseDir, "..", "reports");
  if (existsSync(direct)) {
    return direct;
  }
  if (existsSync(parent)) {
    return parent;
  }
  return direct;
};

const resolveMetricsFilePath = (options: MetricsStoreOptions = {}): string => {
  const now = options.now ?? new Date();
  const baseDir = options.baseDir ?? process.cwd();
  const reportsDir = resolveReportsDir(baseDir);
  return path.join(reportsDir, "metrics", `${dateKey(now)}.json`);
};

const readMetricsFile = async (filePath: string, date: string): Promise<DailyMetrics> => {
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

const writeFileAtomicBestEffort = async (filePath: string, payload: DailyMetrics): Promise<void> => {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(tmpPath, serialized, { encoding: "utf8" });

  try {
    await fs.rename(tmpPath, filePath);
  } catch {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore: file may not exist.
    }
    await fs.rename(tmpPath, filePath);
  }
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

export const incrementMetric = async (
  key: MetricKey,
  options: MetricsStoreOptions = {},
): Promise<DailyMetrics> => {
  const now = options.now ?? new Date();
  const currentDate = dateKey(now);
  const filePath = resolveMetricsFilePath({ ...options, now });

  return enqueueWrite(filePath, async () => {
    const current = await readMetricsFile(filePath, currentDate);
    const next: DailyMetrics = {
      ...current,
      [key]: current[key] + 1,
    };
    await writeFileAtomicBestEffort(filePath, next);
    return next;
  });
};

export const readDailyMetrics = async (options: MetricsStoreOptions = {}): Promise<DailyMetrics> => {
  const now = options.now ?? new Date();
  const currentDate = dateKey(now);
  const filePath = resolveMetricsFilePath({ ...options, now });
  return readMetricsFile(filePath, currentDate);
};
