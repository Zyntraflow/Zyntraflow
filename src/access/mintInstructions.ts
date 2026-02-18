import { getAddress, Interface } from "ethers";

export type MintInstruction = {
  chainId: number;
  to: string;
  value: string;
  data: string;
  functionSignature: string;
  eip681: string;
};

const MINT_ABI = ["function mint() payable"];
const MINT_FUNCTION_SIGNATURE = "mint()";

export const buildMintInstructions = (input: {
  chainId: number;
  contractAddress: string;
  mintPriceWei?: string;
}): MintInstruction => {
  if (!Number.isInteger(input.chainId) || input.chainId <= 0) {
    throw new Error("chainId must be a positive integer.");
  }

  const to = getAddress(input.contractAddress);
  const value = input.mintPriceWei && input.mintPriceWei.length > 0 ? input.mintPriceWei : "0";
  if (!/^[0-9]+$/.test(value)) {
    throw new Error("mintPriceWei must be a non-negative integer string.");
  }

  const iface = new Interface(MINT_ABI);
  const data = iface.encodeFunctionData("mint", []);
  const eip681 = `ethereum:${to}@${input.chainId}?value=${value}&data=${data}`;

  return {
    chainId: input.chainId,
    to,
    value,
    data,
    functionSignature: MINT_FUNCTION_SIGNATURE,
    eip681,
  };
};
