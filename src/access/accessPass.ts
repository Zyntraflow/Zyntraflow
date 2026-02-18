import { Contract, type ContractRunner } from "ethers";
import type { AccessCheckResult, AccessStatus } from "./types";

type BalanceContract = {
  balanceOf: (address: string, tokenId: bigint) => Promise<bigint>;
};

type ContractFactory = (address: string, abi: readonly string[], provider: unknown) => BalanceContract;

const ERC1155_BALANCE_ABI = [
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
] as const;

const sanitizeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/v2\/)([^/\s?#]+)/gi, "$1[REDACTED]");
};

export const checkAccessPass = async (
  provider: unknown,
  userAddress: string,
  status: AccessStatus,
  options?: { contractFactory?: ContractFactory },
): Promise<AccessCheckResult> => {
  if (!status.enabled) {
    return { hasAccess: false, balance: "0" };
  }

  if (!status.contract || status.contract.trim() === "") {
    throw new Error("Access Pass contract address is not configured.");
  }

  const createContract =
    options?.contractFactory ??
    ((address, abi, currentProvider) =>
      new Contract(address, abi, currentProvider as ContractRunner) as unknown as BalanceContract);

  const contract = createContract(status.contract, ERC1155_BALANCE_ABI, provider);
  try {
    const balanceRaw = await contract.balanceOf(userAddress, BigInt(status.tokenId));
    const hasAccess = balanceRaw >= BigInt(status.minBalance);
    return {
      hasAccess,
      balance: balanceRaw.toString(),
    };
  } catch (error) {
    const wrapped = new Error(`Access Pass check failed: ${sanitizeErrorMessage(error)}`);
    Object.assign(wrapped, { cause: error });
    throw wrapped;
  }
};

export const checkAccessPassAcrossChains = async (
  providersByChain: Partial<Record<number, unknown>>,
  userAddress: string,
  status: AccessStatus,
  options?: { contractFactory?: ContractFactory },
): Promise<AccessCheckResult> => {
  if (!status.enabled) {
    return { hasAccess: false, balance: "0", balancesByChain: {}, errors: [] };
  }

  const chains = status.acceptedChains && status.acceptedChains.length > 0 ? status.acceptedChains : [status.chainId];
  const contractsByChain: Record<number, string> = {
    ...(status.contractsByChain ?? {}),
  };
  if (status.contract && status.contract.trim() !== "") {
    contractsByChain[status.chainId] = status.contract;
  }

  const balancesByChain: Record<number, string> = {};
  const errors: string[] = [];
  const createContract =
    options?.contractFactory ??
    ((address, abi, currentProvider) =>
      new Contract(address, abi, currentProvider as ContractRunner) as unknown as BalanceContract);

  let maxBalance = 0n;
  for (const chainId of chains) {
    const provider = providersByChain[chainId];
    if (!provider) {
      errors.push(`Chain ${chainId}: provider unavailable`);
      continue;
    }

    const contractAddress = contractsByChain[chainId];
    if (!contractAddress || contractAddress.trim() === "") {
      errors.push(`Chain ${chainId}: contract not configured`);
      continue;
    }

    try {
      const contract = createContract(contractAddress, ERC1155_BALANCE_ABI, provider);
      const balanceRaw = await contract.balanceOf(userAddress, BigInt(status.tokenId));
      balancesByChain[chainId] = balanceRaw.toString();
      if (balanceRaw >= BigInt(status.minBalance)) {
        return {
          hasAccess: true,
          balance: balanceRaw.toString(),
          matchedChainId: chainId,
          balancesByChain,
          errors,
        };
      }
      if (balanceRaw > maxBalance) {
        maxBalance = balanceRaw;
      }
    } catch (error) {
      errors.push(`Chain ${chainId}: ${sanitizeErrorMessage(error)}`);
    }
  }

  return {
    hasAccess: false,
    balance: maxBalance.toString(),
    balancesByChain,
    errors,
  };
};
