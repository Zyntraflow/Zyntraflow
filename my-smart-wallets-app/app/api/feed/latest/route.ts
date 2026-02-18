import { promises as fs } from "fs";
import path from "path";

export async function GET(): Promise<Response> {
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
