export type RpcEndpoint = {
  name: string;
  url: string;
  priority: number;
};

export type RpcHealth = {
  name: string;
  ok: boolean;
  latencyMs: number;
  chainId: number | null;
  blockNumber: number | null;
  error?: string;
  checkedAt: string;
};
