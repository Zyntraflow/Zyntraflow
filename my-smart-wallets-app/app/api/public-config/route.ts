const parseIntOrNull = (raw: string | undefined, min = 0): number | null => {
  if (!raw || raw.trim() === "") {
    return null;
  }

  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < min) {
    return null;
  }

  return value;
};

const parseAddressOrNull = (raw: string | undefined): string | null => {
  if (!raw || raw.trim() === "") {
    return null;
  }

  const value = raw.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? value : null;
};

const parseWeiOrNull = (raw: string | undefined): string | null => {
  if (!raw || raw.trim() === "") {
    return null;
  }

  const value = raw.trim();
  return /^[0-9]+$/.test(value) ? value : null;
};

const buildMintLink = (
  contractAddress: string | null,
  chainId: number | null,
  mintPriceWei: string | null,
): string | null => {
  if (!contractAddress || !chainId) {
    return null;
  }

  const query = new URLSearchParams();
  if (mintPriceWei) {
    query.set("value", mintPriceWei);
  }
  query.set("data", "0x1249c58b");

  return `ethereum:${contractAddress}@${chainId}?${query.toString()}`;
};

export async function GET(): Promise<Response> {
  const chainId = parseIntOrNull(process.env.ACCESS_PASS_CHAIN_ID, 1);
  const contractAddress = parseAddressOrNull(process.env.ACCESS_PASS_CONTRACT_ADDRESS);
  const tokenId = parseIntOrNull(process.env.ACCESS_PASS_TOKEN_ID, 0) ?? 1;
  const minBalance = parseIntOrNull(process.env.ACCESS_PASS_MIN_BALANCE, 1) ?? 1;
  const mintPriceWei = parseWeiOrNull(process.env.ACCESS_PASS_MINT_PRICE_WEI);
  const mintLink = buildMintLink(contractAddress, chainId, mintPriceWei);

  return Response.json(
    {
      ACCESS_PASS_CHAIN_ID: chainId,
      ACCESS_PASS_CONTRACT_ADDRESS: contractAddress,
      ACCESS_PASS_TOKEN_ID: tokenId,
      ACCESS_PASS_MIN_BALANCE: minBalance,
      ACCESS_PASS_MINT_PRICE_WEI: mintPriceWei,
      ACCESS_PASS_MINT_EIP681: mintLink,
      FEED_LATEST_PATH: "/api/feed/latest",
      FEED_HISTORY_PATH: "/api/feed/history",
      HEALTH_PATH: "/api/health",
      PREMIUM_PULL_TEMPLATE: "/api/premium/<reportHash>/<address>",
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
