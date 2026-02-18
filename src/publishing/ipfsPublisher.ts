export type PublishResult = {
  cid: string;
  url?: string;
};

type PublishOptions = {
  uploadUrl?: string;
  authToken?: string;
  fetchImpl?: typeof fetch;
};

const extractCid = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const direct = record.cid ?? record.CID ?? record.IpfsHash ?? record.hash;
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  if (record.value && typeof record.value === "object") {
    const nested = (record.value as Record<string, unknown>).cid;
    if (typeof nested === "string" && nested.length > 0) {
      return nested;
    }
  }

  return undefined;
};

export const publishJson = async (summary: object, options?: PublishOptions): Promise<PublishResult> => {
  const uploadUrl = options?.uploadUrl ?? process.env.IPFS_UPLOAD_URL;
  if (!uploadUrl || uploadUrl.trim() === "") {
    throw new Error("IPFS upload is not configured. Set IPFS_UPLOAD_URL to enable publishing.");
  }

  const token = options?.authToken ?? process.env.IPFS_AUTH_TOKEN;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (token && token.trim() !== "") {
    headers.authorization = `Bearer ${token.trim()}`;
  }

  const response = await fetchImpl(uploadUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(summary),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`IPFS publish failed with status ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const cid = extractCid(payload);
  if (!cid) {
    throw new Error("IPFS publish response did not include a CID.");
  }

  const url = typeof payload.url === "string" ? payload.url : `https://ipfs.io/ipfs/${cid}`;
  return { cid, url };
};
