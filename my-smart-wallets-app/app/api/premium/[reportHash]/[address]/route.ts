import { existsSync, promises as fs } from "fs";
import path from "path";
import { getAddress } from "ethers";

type IpCounter = {
  windowStart: number;
  count: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const ipCounters = new Map<string, IpCounter>();

const getClientIp = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded && forwarded.trim().length > 0) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }
  return "unknown";
};

const isIpAllowed = (ip: string): boolean => {
  const now = Date.now();
  const entry = ipCounters.get(ip);
  if (!entry || now >= entry.windowStart + WINDOW_MS) {
    ipCounters.set(ip, { windowStart: now, count: 1 });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  entry.count += 1;
  ipCounters.set(ip, entry);
  return true;
};

const reportHashPattern = /^0x[a-fA-F0-9]{64}$/;

export async function GET(
  request: Request,
  context: { params: { reportHash: string; address: string } },
): Promise<Response> {
  const ip = getClientIp(request);
  if (!isIpAllowed(ip)) {
    return Response.json({ message: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const params = context.params;
  const reportHash = params.reportHash;
  if (!reportHashPattern.test(reportHash)) {
    return Response.json({ message: "Invalid report hash format." }, { status: 400 });
  }

  let normalizedAddress: string;
  try {
    normalizedAddress = getAddress(params.address).toLowerCase();
  } catch {
    return Response.json({ message: "Invalid wallet address format." }, { status: 400 });
  }

  const premiumDirCandidates = [
    path.resolve(process.cwd(), "reports", "premium", reportHash),
    path.resolve(process.cwd(), "..", "reports", "premium", reportHash),
  ];
  const premiumDir = premiumDirCandidates.find((candidate) => existsSync(candidate)) ?? premiumDirCandidates[0];
  const primaryPath = path.join(premiumDir, `${normalizedAddress}.json`);

  let targetPath = primaryPath;
  try {
    await fs.access(primaryPath);
  } catch {
    try {
      const files = await fs.readdir(premiumDir);
      const matches = files
        .filter((name) => name.startsWith(`${normalizedAddress}-`) && name.endsWith(".json"))
        .sort();
      if (matches.length === 0) {
        return Response.json({ message: "Premium package not found for this report hash and address." }, { status: 404 });
      }
      targetPath = path.join(premiumDir, matches[matches.length - 1]);
    } catch {
      return Response.json({ message: "Premium package not found for this report hash and address." }, { status: 404 });
    }
  }

  try {
    const raw = await fs.readFile(targetPath, "utf8");
    const payload = JSON.parse(raw);
    return Response.json(payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json({ message: "Premium package unavailable." }, { status: 404 });
  }
}
