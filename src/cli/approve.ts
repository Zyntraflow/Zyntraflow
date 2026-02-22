import { JsonRpcProvider } from "ethers";
import { loadConfig } from "../config";
import { approveToken } from "../execution/approvals";

type ApproveCliArgs = {
  chainId: number;
  token: string;
  spender: string;
  amount: string;
  decimals: number;
};

const parseArgs = (argv: string[] = process.argv.slice(2)): ApproveCliArgs => {
  const values: Partial<ApproveCliArgs> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!token.startsWith("--")) {
      continue;
    }
    if (!value) {
      throw new Error(`Missing value for ${token}`);
    }

    if (token === "--chain-id") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Invalid --chain-id value.");
      }
      values.chainId = parsed;
      index += 1;
      continue;
    }
    if (token === "--token") {
      values.token = value;
      index += 1;
      continue;
    }
    if (token === "--spender") {
      values.spender = value;
      index += 1;
      continue;
    }
    if (token === "--amount") {
      values.amount = value;
      index += 1;
      continue;
    }
    if (token === "--decimals") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 36) {
        throw new Error("Invalid --decimals value.");
      }
      values.decimals = parsed;
      index += 1;
      continue;
    }
  }

  if (
    values.chainId === undefined ||
    !values.token ||
    !values.spender ||
    !values.amount ||
    values.decimals === undefined
  ) {
    throw new Error(
      "Missing required args. Usage: npm run approve:execution -- --chain-id <id> --token <0x...> --spender <0x...> --amount <value> --decimals <n>",
    );
  }

  return values as ApproveCliArgs;
};

const run = async (): Promise<void> => {
  try {
    const args = parseArgs();
    const config = loadConfig();
    const provider = new JsonRpcProvider(config.ALCHEMY_URL, args.chainId);
    const result = await approveToken({
      provider,
      config: config.EXECUTION,
      chainId: args.chainId,
      token: args.token,
      spender: args.spender,
      amount: args.amount,
      decimals: args.decimals,
    });
    process.stdout.write(`Approval tx hash: ${result.txHash}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval failed.";
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
};

void run();
