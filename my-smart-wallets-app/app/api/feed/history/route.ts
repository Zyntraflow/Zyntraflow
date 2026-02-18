import { promises as fs } from "fs";
import path from "path";

const isValidDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const todaySegment = (): string => new Date().toISOString().slice(0, 10);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const date = dateParam && isValidDate(dateParam) ? dateParam : todaySegment();
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, Math.min(500, Number(limitRaw) || 100)) : 100;

  const historyPath = path.join(process.cwd(), "public", "public-feed", "history", `${date}.jsonl`);

  try {
    const raw = await fs.readFile(historyPath, "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const recent = lines.slice(-limit).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });

    return Response.json(
      {
        date,
        count: recent.length,
        items: recent,
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
        message: `No feed history available for ${date}.`,
      },
      {
        status: 404,
      },
    );
  }
}
