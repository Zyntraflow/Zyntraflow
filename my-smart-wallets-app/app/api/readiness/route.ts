import "server-only";

import { existsSync, promises as fs } from "fs";
import path from "path";

type ReadinessPayload = {
  ts: string;
  lastTickOk: boolean;
  lastReportHash: string | null;
  chainsScanned: number;
  profileId: string;
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
