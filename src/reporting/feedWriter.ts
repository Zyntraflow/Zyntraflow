import fs from "fs";
import path from "path";

const dateSegment = (date: Date): string => date.toISOString().slice(0, 10);

const writeFeedAtRoot = (feedRoot: string, serialized: string, now: Date): { latestPath: string; historyPath: string } => {
  const historyDir = path.join(feedRoot, "history");
  const latestPath = path.join(feedRoot, "latest.json");
  const historyPath = path.join(historyDir, `${dateSegment(now)}.jsonl`);
  fs.mkdirSync(historyDir, { recursive: true });
  fs.writeFileSync(latestPath, `${serialized}\n`, { encoding: "utf8" });
  fs.appendFileSync(historyPath, `${serialized}\n`, { encoding: "utf8" });
  return {
    latestPath,
    historyPath,
  };
};

export const writePublicFeed = (
  signedSummary: unknown,
  options?: { baseDir?: string; now?: Date },
): { latestPath: string; historyPath: string; webLatestPath?: string; webHistoryPath?: string } => {
  const now = options?.now ?? new Date();
  const baseDir = options?.baseDir ?? process.cwd();
  const serialized = JSON.stringify(signedSummary);
  const rootFeedPaths = writeFeedAtRoot(path.join(baseDir, "public-feed"), serialized, now);

  const webPublicDir = path.join(baseDir, "my-smart-wallets-app", "public");
  if (fs.existsSync(webPublicDir)) {
    const webFeedPaths = writeFeedAtRoot(path.join(webPublicDir, "public-feed"), serialized, now);
    return {
      ...rootFeedPaths,
      webLatestPath: webFeedPaths.latestPath,
      webHistoryPath: webFeedPaths.historyPath,
    };
  }

  return rootFeedPaths;
};
