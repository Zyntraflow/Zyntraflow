import { getAddress } from "ethers";
import { getSubscription } from "@/lib/subscriptionStore";

export async function GET(
  _request: Request,
  context: { params: { address: string } },
): Promise<Response> {
  let normalizedAddress: string;
  try {
    normalizedAddress = getAddress(context.params.address);
  } catch {
    return Response.json({ message: "Invalid wallet address format." }, { status: 400 });
  }

  try {
    const subscription = await getSubscription(normalizedAddress);
    if (!subscription) {
      return Response.json({ message: "Subscription not found." }, { status: 404 });
    }

    return Response.json(
      {
        ...subscription,
        signature: "[REDACTED]",
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch {
    return Response.json({ message: "Subscription unavailable." }, { status: 500 });
  }
}
