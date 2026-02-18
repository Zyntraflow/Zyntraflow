import fs from "fs";
import path from "path";

const formatDateSegment = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

const makeTimestamp = (date: Date): string => {
  return date.toISOString().replace(/[:.]/g, "-");
};

export const writeScanReport = (
  report: unknown,
  options?: {
    enabled?: boolean;
    baseDir?: string;
    now?: Date;
    filePrefix?: string;
  },
): string | null => {
  const enabled = options?.enabled ?? false;
  if (!enabled) {
    return null;
  }

  const now = options?.now ?? new Date();
  const dateSegment = formatDateSegment(now);
  const timestamp = makeTimestamp(now);
  const baseDir = options?.baseDir ?? process.cwd();
  const filePrefix = options?.filePrefix ?? "scan";
  const reportDir = path.join(baseDir, "reports", dateSegment);

  fs.mkdirSync(reportDir, { recursive: true });

  let suffix = 0;
  let fileName = `${filePrefix}-${timestamp}.json`;
  let filePath = path.join(reportDir, fileName);

  while (fs.existsSync(filePath)) {
    suffix += 1;
    fileName = `${filePrefix}-${timestamp}-${suffix}.json`;
    filePath = path.join(reportDir, fileName);
  }

  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), { encoding: "utf8", flag: "wx" });
  return filePath;
};
