import "server-only";

import { existsSync, promises as fs } from "fs";
import path from "path";

const resolveAlertsLatestPath = (): string => {
  const direct = path.join(process.cwd(), "reports", "alerts", "latest.json");
  const parent = path.join(process.cwd(), "..", "reports", "alerts", "latest.json");
  if (existsSync(direct)) {
    return direct;
  }
  if (existsSync(parent)) {
    return parent;
  }
  return direct;
};

export async function GET(): Promise<Response> {
  const filePath = resolveAlertsLatestPath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const payload = JSON.parse(raw);
    return Response.json(payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        updatedAt: new Date().toISOString(),
        global: [],
        byUser: {},
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}
