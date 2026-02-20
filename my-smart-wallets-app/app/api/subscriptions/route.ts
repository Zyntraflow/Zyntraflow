import { saveSubscription } from "@/lib/subscriptionStore";
import type { Subscription } from "@/lib/subscriptionAuth";

const MAX_REQUEST_BYTES = 16 * 1024;

export async function POST(request: Request): Promise<Response> {
  const contentLengthRaw = request.headers.get("content-length");
  if (contentLengthRaw) {
    const contentLength = Number(contentLengthRaw);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return Response.json({ message: "Payload too large." }, { status: 413 });
    }
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 });
  }
  if (!raw || raw.length > MAX_REQUEST_BYTES) {
    return Response.json({ message: "Payload too large." }, { status: 413 });
  }

  let parsed: Subscription;
  try {
    parsed = JSON.parse(raw) as Subscription;
  } catch {
    return Response.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const saved = await saveSubscription(parsed);
    return Response.json(
      {
        ok: true,
        userAddress: saved.userAddress,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save subscription.";
    return Response.json({ message }, { status: 400 });
  }
}
