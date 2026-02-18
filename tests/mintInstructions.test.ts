import { Interface } from "ethers";
import { describe, expect, it } from "vitest";
import { buildMintInstructions } from "../src/access/mintInstructions";

describe("mint instructions", () => {
  it("encodes mint calldata correctly", () => {
    const instructions = buildMintInstructions({
      chainId: 42161,
      contractAddress: "0x000000000000000000000000000000000000dEaD",
      mintPriceWei: "12345",
    });
    const expectedData = new Interface(["function mint() payable"]).encodeFunctionData("mint", []);

    expect(instructions.chainId).toBe(42161);
    expect(instructions.to).toBe("0x000000000000000000000000000000000000dEaD");
    expect(instructions.value).toBe("12345");
    expect(instructions.data).toBe(expectedData);
    expect(instructions.functionSignature).toBe("mint()");
  });

  it("builds an EIP-681 deep link", () => {
    const instructions = buildMintInstructions({
      chainId: 1,
      contractAddress: "0x000000000000000000000000000000000000dEaD",
      mintPriceWei: "0",
    });

    expect(instructions.eip681).toBe(
      "ethereum:0x000000000000000000000000000000000000dEaD@1?value=0&data=0x1249c58b",
    );
  });
});
