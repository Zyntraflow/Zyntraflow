import { JsonRpcProvider } from "ethers";
import { loadConfig } from "../config";
import { approveERC20 } from "../execution/approvals";

type ApproveCliArgs = {
  token: string;
  spender: string;
  amount: string;
  chainId?: number;
  decimals?: number;
  confirmed: boolean;
};

const parseArgs = (argv: string[] = process.argv.slice(2)): ApproveCliArgs => {
  const values: Partial<ApproveCliArgs> = {
    confirmed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!token.startsWith("--")) {
      continue;
    }
    if (!value && token !== "--i-understand") {
      throw new Error(`Missing value for ${token}`);
    }

    if (token === "--chain-id") {
      const parsed = Number(value as string);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Invalid --chain-id value.");
      }
      values.chainId = parsed;
      index += 1;
      continue;
    }
    if (token === "--token") {
      values.token = value as string;
      index += 1;
      continue;
    }
    if (token === "--spender") {
      values.spender = value as string;
      index += 1;
      continue;
    }
    if (token === "--amount") {
      values.amount = value as string;
      index += 1;
      continue;
    }
    if (token === "--decimals") {
      const parsed = Number(value as string);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 36) {
        throw new Error("Invalid --decimals value.");
      }
      values.decimals = parsed;
      index += 1;
      continue;
    }
    if (token === "--i-understand") {
      values.confirmed = true;
      continue;
    }
  }

  if (!values.token || !values.spender || !values.amount) {
    throw new Error(
      "Missing required args. Usage: npm run approve -- --token <0x...> --spender <0x...> --amount <value> [--chain-id <id>] [--decimals <n>] --i-understand",
    );
  }
  if (!values.confirmed) {
    throw new Error("Approval command refused: add --i-understand to confirm manual approval risk.");
  }

  return values as ApproveCliArgs;
};

const run = async (): Promise<void> => {
  try {
    const args = parseArgs();
    const config = loadConfig();
    const chainId = args.chainId ?? config.EXECUTION.CHAIN_ID;
    const provider = new JsonRpcProvider(config.ALCHEMY_URL, chainId);
    const decimals = args.decimals ?? 18;
    const result = await approveERC20({
      provider,
      config: config.EXECUTION,
      chainId,
      token: args.token,
      spender: args.spender,
      amount: args.amount,
      decimals,
    });
    process.stdout.write(
      `Approval submitted token=${args.token.toLowerCase()} spender=${args.spender.toLowerCase()} amount=${args.amount}\n`,
    );
    process.stdout.write(`Approval tx hash: ${result.txHash}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval failed.";
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
};

void run();
