import "server-only";

import { existsSync, promises as fs } from "fs";
import path from "path";

type ReadinessPayload = {
  ts: string;
  lastTickOk: boolean;
  lastReportHash: string | null;
  chainsScanned: number;
  profileId: string;
  consecutiveFailures: number;
  lastBackoffMs: number;
  lastRestartAt: string | null;
};

const resolveReadinessPath = (): string => {
  const direct = path.join(process.cwd(), "reports", "readiness.json");
  const parent = path.join(process.cwd(), "..", "reports", "readiness.json");
  if (existsSync(direct)) {
    return direct;
  }
  if (existsSync(parent)) {
    return parent;
  }
  return direct;
};

export async function GET(): Promise<Response> {
  const filePath = resolveReadinessPath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const payload = JSON.parse(raw) as Partial<ReadinessPayload>;
    return Response.json(
      {
        ts: typeof payload.ts === "string" ? payload.ts : new Date(0).toISOString(),
        lastTickOk: Boolean(payload.lastTickOk),
        lastReportHash: typeof payload.lastReportHash === "string" ? payload.lastReportHash : null,
        chainsScanned:
          typeof payload.chainsScanned === "number" && Number.isInteger(payload.chainsScanned) && payload.chainsScanned >= 0
            ? payload.chainsScanned
            : 0,
        profileId: typeof payload.profileId === "string" ? payload.profileId : "unknown",
        consecutiveFailures:
          typeof payload.consecutiveFailures === "number" &&
          Number.isInteger(payload.consecutiveFailures) &&
          payload.consecutiveFailures >= 0
            ? payload.consecutiveFailures
            : 0,
        lastBackoffMs:
          typeof payload.lastBackoffMs === "number" && Number.isInteger(payload.lastBackoffMs) && payload.lastBackoffMs >= 0
            ? payload.lastBackoffMs
            : 0,
        lastRestartAt: typeof payload.lastRestartAt === "string" ? payload.lastRestartAt : null,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      {
        message: "Readiness artifact not found yet. Operator must complete at least one tick.",
      },
      {
        status: 404,
      },
    );
  }
}
