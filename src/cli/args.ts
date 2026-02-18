export type CliArgs = {
  address?: string;
  signature?: string;
  premiumOverride?: boolean;
  operatorOverride?: boolean;
  intervalOverride?: number;
  mintInfo: boolean;
  mintCalldata: boolean;
  printLoginMessage: boolean;
};

const parseBoolean = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new Error(`Invalid boolean value: ${value}`);
};

export const parseCliArgs = (argv: string[] = process.argv.slice(2)): CliArgs => {
  const args: CliArgs = {
    mintInfo: false,
    mintCalldata: false,
    printLoginMessage: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--mint-info") {
      args.mintInfo = true;
      continue;
    }

    if (token === "--mint-calldata") {
      args.mintCalldata = true;
      continue;
    }

    if (token === "--address") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --address");
      }
      args.address = value;
      index += 1;
      continue;
    }

    if (token === "--signature") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --signature");
      }
      args.signature = value;
      index += 1;
      continue;
    }

    if (token === "--premium") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --premium");
      }
      args.premiumOverride = parseBoolean(value);
      index += 1;
      continue;
    }

    if (token === "--operator") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --operator");
      }
      args.operatorOverride = parseBoolean(value);
      index += 1;
      continue;
    }

    if (token === "--interval") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --interval");
      }
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid interval value: ${value}`);
      }
      args.intervalOverride = parsed;
      index += 1;
      continue;
    }

    if (token === "--print-login-message") {
      args.printLoginMessage = true;
      continue;
    }
  }

  return args;
};
