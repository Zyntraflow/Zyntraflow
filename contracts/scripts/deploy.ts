import { ethers } from "hardhat";

const parsePositiveInteger = (value: string, name: string): bigint => {
  const parsed = BigInt(value);
  if (parsed < 0n) {
    throw new Error(`${name} must be non-negative.`);
  }
  return parsed;
};

async function main(): Promise<void> {
  const baseUri = process.env.ACCESS_PASS_BASE_URI?.trim() || "ipfs://access-pass/{id}.json";
  const mintPriceEth = process.env.ACCESS_PASS_PRICE_ETH?.trim() || "0.01";
  const tokenIdRaw = process.env.ACCESS_PASS_TOKEN_ID?.trim() || "1";

  const tokenId = parsePositiveInteger(tokenIdRaw, "ACCESS_PASS_TOKEN_ID");
  const mintPriceWei = ethers.parseEther(mintPriceEth);

  const AccessPassFactory = await ethers.getContractFactory("AccessPass1155");
  const contract = await AccessPassFactory.deploy(baseUri, mintPriceWei, tokenId);
  await contract.waitForDeployment();

  process.stdout.write(`${await contract.getAddress()}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Deploy failed: ${message}\n`);
  process.exit(1);
});
