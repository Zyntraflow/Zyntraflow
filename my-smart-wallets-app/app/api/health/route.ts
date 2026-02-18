import { promises as fs } from "fs";
import path from "path";
import { incrementMetricCounter } from "@/lib/metricsStore";

type OperatorHealth = {
  timestamp: string;
  lastTickAt: string | null;
  lastTickOk: boolean;
  lastError: string | null;
  lastReportHash: string | null;
};

const defaultHealth = (): OperatorHealth => ({
  timestamp: new Date().toISOString(),
  lastTickAt: null,
  lastTickOk: false,
  lastError: null,
  lastReportHash: null,
});

export async function GET(): Promise<Response> {
  try {
    await incrementMetricCounter("healthHits");
  } catch {
    // Metrics are best-effort and must not block health responses.
  }

  const healthPath = path.join(process.cwd(), "public", "public-feed", "operator-health.json");

  let health = defaultHealth();
  try {
    const raw = await fs.readFile(healthPath, "utf8");
    health = {
      ...health,
      ...(JSON.parse(raw) as Partial<OperatorHealth>),
    };
  } catch {
    // Default health for web-only mode.
  }

  return Response.json(
    {
      ok: true,
      timestamp: new Date().toISOString(),
      lastTickAt: health.lastTickAt,
      lastTickOk: health.lastTickOk,
      lastReportHash: health.lastReportHash,
      lastError: health.lastError,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
