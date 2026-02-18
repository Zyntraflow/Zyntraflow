import { incrementMetricCounter, type MetricKey } from "@/lib/metricsStore";

const ALLOWED: ReadonlyArray<MetricKey> = [
  "feedLatestHits",
  "feedHistoryHits",
  "healthHits",
  "premiumPullHits",
  "launchPageHits",
];

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const name = url.searchParams.get("name") as MetricKey | null;

  if (!name || !ALLOWED.includes(name)) {
    return Response.json(
      {
        message: "Invalid metric name.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    await incrementMetricCounter(name);
    return new Response(null, {
      status: 204,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        message: "Metric update failed.",
      },
      {
        status: 500,
      },
    );
  }
}
