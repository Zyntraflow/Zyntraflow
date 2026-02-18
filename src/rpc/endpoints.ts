import type { AppConfig } from "../config";
import type { RpcEndpoint } from "./types";

const dedupe = (items: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
};

export const loadRpcEndpoints = (config: Pick<AppConfig, "ALCHEMY_URL" | "RPC_FALLBACK_URLS">): RpcEndpoint[] => {
  const fallbackUrls = dedupe(config.RPC_FALLBACK_URLS).filter((url) => url !== config.ALCHEMY_URL);

  const endpoints: RpcEndpoint[] = [
    {
      name: "primary",
      url: config.ALCHEMY_URL,
      priority: 1,
    },
  ];

  fallbackUrls.forEach((url, index) => {
    endpoints.push({
      name: `fallback-${index + 1}`,
      url,
      priority: index + 2,
    });
  });

  return endpoints;
};
