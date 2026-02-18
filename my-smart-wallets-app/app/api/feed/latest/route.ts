import { promises as fs } from "fs";
import path from "path";
import { incrementMetricCounter } from "@/lib/metricsStore";

export async function GET(): Promise<Response> {
  try {
    await incrementMetricCounter("feedLatestHits");
  } catch {
    // Metrics are best-effort and must not block feed reads.
  }

  const latestPath = path.join(process.cwd(), "public", "public-feed", "latest.signed.json");

  try {
    const raw = await fs.readFile(latestPath, "utf8");
    const payload = JSON.parse(raw.trim());
    return Response.json(payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        message: "No signed feed available yet. Run operator to publish the first summary.",
      },
      {
        status: 404,
      },
    );
  }
}
