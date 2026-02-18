import { isPublicMetricsEnabled, readTodayMetrics } from "@/lib/metricsStore";

export async function GET(): Promise<Response> {
  if (!isPublicMetricsEnabled()) {
    return Response.json(
      {
        message: "Public metrics are disabled.",
      },
      {
        status: 404,
      },
    );
  }

  try {
    const metrics = await readTodayMetrics();
    return Response.json(metrics, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        message: "Metrics unavailable.",
      },
      {
        status: 500,
      },
    );
  }
}
