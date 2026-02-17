import dotenv from "dotenv";

dotenv.config({ quiet: true });

export type AppConfig = {
  ALCHEMY_URL: string;
  WALLET_PRIVATE_KEY: string;
  TARGET_NETWORK: string;
  MIN_PROFIT_GAP: number;
};

export class MissingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingConfigError";
  }
}

const requireEnv = (name: keyof Omit<AppConfig, "MIN_PROFIT_GAP"> | "MIN_PROFIT_GAP"): string => {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new MissingConfigError(
      `Missing required environment variable "${name}". Copy .env.example to .env and set all required values.`,
    );
  }
  return value.trim();
};

export const loadConfig = (): AppConfig => {
  const minProfitGapRaw = requireEnv("MIN_PROFIT_GAP");
  const minProfitGap = Number(minProfitGapRaw);

  if (!Number.isFinite(minProfitGap)) {
    throw new MissingConfigError('MIN_PROFIT_GAP must be a valid number.');
  }

  return {
    ALCHEMY_URL: requireEnv("ALCHEMY_URL"),
    WALLET_PRIVATE_KEY: requireEnv("WALLET_PRIVATE_KEY"),
    TARGET_NETWORK: requireEnv("TARGET_NETWORK"),
    MIN_PROFIT_GAP: minProfitGap,
  };
};
