import dotenv from "dotenv";

dotenv.config({ path: ".env.operator", override: false, quiet: true });
dotenv.config({ path: ".env", override: false, quiet: true });
dotenv.config({ path: ".env.execution", override: false, quiet: true });

export type ExecutionConfig = {
  ENABLED: boolean;
  CHAIN_ID: number;
  PRIVATE_KEY?: string;
  APPROVALS_ENABLED: boolean;
  APPROVALS_MAX_AMOUNT: number;
  APPROVALS_ALLOWLIST: string[];
  MAX_TRADE_ETH: number;
  MAX_GAS_GWEI: number;
  MAX_SLIPPAGE_BPS: number;
  MIN_NET_PROFIT_ETH: number;
  DAILY_LOSS_LIMIT_ETH: number;
  COOLDOWN_SECONDS: number;
  REPLAY_WINDOW_SECONDS: number;
  ALLOW_REPLAY: boolean;
  PENDING_TIMEOUT_SECONDS: number;
  MAX_CONSECUTIVE_SEND_FAILS: number;
  TO_ADDRESS_ALLOWLIST: string[];
  KILL_SWITCH_FILE: string;
};

export type AppConfig = {
  ALCHEMY_URL: string;
  WALLET_PRIVATE_KEY: string;
  TARGET_NETWORK: string;
  MIN_PROFIT_GAP: number;
  RPC_FALLBACK_URLS: string[];
  ENABLE_REPORT_PERSISTENCE: boolean;
  CHAIN_ID?: number;
  ACCESS_PASS_CHAIN_ID?: number;
  ACCESS_PASS_CONTRACT_ADDRESS?: string;
  ACCESS_PASS_TOKEN_ID: number;
  ACCESS_PASS_MIN_BALANCE: number;
  ENABLE_PREMIUM_MODE: boolean;
  USER_WALLET_ADDRESS?: string;
  USER_LOGIN_SIGNATURE?: string;
  PREMIUM_SIGNER_KEY?: string;
  APP_SIGNER_KEY?: string;
  PREMIUM_PACKAGE_TTL_SECONDS: number;
  PREMIUM_PACKAGE_VERSION: number;
  PREMIUM_MAX_PACKAGES_PER_HOUR: number;
  PREMIUM_RATE_LIMIT_WINDOW_SECONDS: number;
  IPFS_UPLOAD_URL?: string;
  IPFS_AUTH_TOKEN?: string;
  ENABLE_DISCORD_ALERTS: boolean;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_CHANNEL_ID?: string;
  DISCORD_ALERTS_MIN_INTERVAL_SECONDS: number;
  ENABLE_TELEGRAM_ALERTS: boolean;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_ALERTS_MIN_INTERVAL_SECONDS: number;
  ENABLE_PUBLIC_SUMMARY_PUBLISH: boolean;
  ENABLE_PUBLIC_METRICS: boolean;
  ACCESS_PASS_MINT_PRICE_WEI?: string;
  ACCESS_PASS_ACCEPTED_CHAINS: number[];
  ACCESS_PASS_CONTRACTS_BY_CHAIN: Record<number, string>;
  OPERATOR_INTERVAL_SECONDS: number;
  OPERATOR_ENABLE: boolean;
  OPERATOR_MAX_TICKS: number;
  OPERATOR_JITTER_MS: number;
  RPC_MAX_CONCURRENCY: number;
  RPC_RETRY_MAX: number;
  RPC_RETRY_BACKOFF_MS: number;
  RPC_TIMEOUT_MS: number;
  EXECUTION: ExecutionConfig;
};

export class MissingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingConfigError";
  }
}

export type RuntimeConfig = {
  NODE_ENV: string;
  LOG_LEVEL?: string;
};

type RequiredEnvKey = "ALCHEMY_URL" | "WALLET_PRIVATE_KEY" | "TARGET_NETWORK" | "MIN_PROFIT_GAP";

const requireEnv = (name: RequiredEnvKey): string => {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new MissingConfigError(
      `Missing required environment variable "${name}". Copy .env.example to .env and set all required values.`,
    );
  }
  return value.trim();
};

const parseCsvEnv = (name: "RPC_FALLBACK_URLS" | "ACCESS_PASS_ACCEPTED_CHAINS"): string[] => {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const parseBooleanEnv = (
  name:
    | "ENABLE_REPORT_PERSISTENCE"
    | "ENABLE_PREMIUM_MODE"
    | "ENABLE_PUBLIC_SUMMARY_PUBLISH"
    | "ENABLE_PUBLIC_METRICS"
    | "ENABLE_DISCORD_ALERTS"
    | "ENABLE_TELEGRAM_ALERTS"
    | "OPERATOR_ENABLE"
    | "EXECUTION_ENABLED"
    | "APPROVALS_ENABLED"
    | "EXECUTION_ALLOW_REPLAY",
  fallback: boolean,
): boolean => {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const parseOptionalIntegerEnv = (
  name: "ACCESS_PASS_CHAIN_ID" | "CHAIN_ID",
  options?: { min?: number },
): number | undefined => {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value.trim());
  const min = options?.min ?? 1;
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new MissingConfigError(`${name} must be an integer >= ${min} when set.`);
  }

  return parsed;
};

const parseIntegerEnvWithDefault = (
  name:
    | "ACCESS_PASS_TOKEN_ID"
    | "ACCESS_PASS_MIN_BALANCE"
    | "PREMIUM_PACKAGE_TTL_SECONDS"
    | "PREMIUM_PACKAGE_VERSION"
    | "PREMIUM_MAX_PACKAGES_PER_HOUR"
    | "PREMIUM_RATE_LIMIT_WINDOW_SECONDS"
    | "OPERATOR_INTERVAL_SECONDS"
    | "OPERATOR_MAX_TICKS"
    | "OPERATOR_JITTER_MS"
    | "RPC_MAX_CONCURRENCY"
    | "RPC_RETRY_MAX"
    | "RPC_RETRY_BACKOFF_MS"
    | "RPC_TIMEOUT_MS"
    | "DISCORD_ALERTS_MIN_INTERVAL_SECONDS"
    | "TELEGRAM_ALERTS_MIN_INTERVAL_SECONDS"
    | "EXECUTION_CHAIN_ID"
    | "EXECUTION_MAX_SLIPPAGE_BPS"
    | "EXECUTION_COOLDOWN_SECONDS"
    | "EXECUTION_REPLAY_WINDOW_SECONDS"
    | "EXECUTION_PENDING_TIMEOUT_SECONDS"
    | "EXECUTION_MAX_CONSECUTIVE_SEND_FAILS",
  defaultValue: number,
  options?: { min?: number },
): number => {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value.trim());
  const min = options?.min ?? 0;
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new MissingConfigError(`${name} must be an integer >= ${min}.`);
  }

  return parsed;
};

const parseDecimalEnvWithDefault = (
  name:
    | "EXECUTION_MAX_TRADE_ETH"
    | "EXECUTION_MAX_GAS_GWEI"
    | "EXECUTION_MIN_NET_PROFIT_ETH"
    | "EXECUTION_DAILY_LOSS_LIMIT_ETH"
    | "APPROVALS_MAX_AMOUNT",
  defaultValue: number,
  options?: { min?: number },
): number => {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value.trim());
  const min = options?.min ?? 0;
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new MissingConfigError(`${name} must be a number >= ${min}.`);
  }

  return parsed;
};

const isHexAddress = (value: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(value);

const parseOptionalAddressEnv = (
  name: "ACCESS_PASS_CONTRACT_ADDRESS" | "USER_WALLET_ADDRESS",
): string | undefined => {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return undefined;
  }

  const normalized = value.trim();
  if (!isHexAddress(normalized)) {
    throw new MissingConfigError(`${name} must be a valid 0x-prefixed hex address.`);
  }

  return normalized;
};

const parseOptionalTextEnv = (
  name:
    | "USER_LOGIN_SIGNATURE"
    | "IPFS_UPLOAD_URL"
    | "IPFS_AUTH_TOKEN"
    | "ACCESS_PASS_CONTRACTS_JSON"
    | "DISCORD_BOT_TOKEN"
    | "DISCORD_CHANNEL_ID"
    | "TELEGRAM_BOT_TOKEN"
    | "TELEGRAM_CHAT_ID",
): string | undefined => {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return undefined;
  }

  return value.trim();
};

const parseOptionalWeiEnv = (name: "ACCESS_PASS_MINT_PRICE_WEI"): string | undefined => {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^[0-9]+$/.test(normalized)) {
    throw new MissingConfigError(`${name} must be a non-negative integer in wei.`);
  }
  return normalized;
};

const parseOptionalPremiumSignerKey = (): string | undefined => {
  const envName = ["PREMIUM", "SIGNER", "PRIVATE", "KEY"].join("_");
  const value = process.env[envName];
  if (!value || value.trim() === "") {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new MissingConfigError(`${envName} must be a 64-hex private key (optionally 0x-prefixed).`);
  }

  return normalized.startsWith("0x") ? normalized : `0x${normalized}`;
};

const parseOptionalExecutionPrivateKey = (): string | undefined => {
  const value = process.env.EXECUTION_PRIVATE_KEY;
  if (!value || value.trim() === "") {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new MissingConfigError("EXECUTION_PRIVATE_KEY must be a 64-hex private key (optionally 0x-prefixed).");
  }

  return normalized.startsWith("0x") ? normalized : `0x${normalized}`;
};

const parseExecutionAllowlist = (): string[] => {
  const raw = process.env.EXECUTION_TO_ADDRESS_ALLOWLIST_JSON?.trim();
  if (!raw || raw === "") {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MissingConfigError("EXECUTION_TO_ADDRESS_ALLOWLIST_JSON must be valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new MissingConfigError("EXECUTION_TO_ADDRESS_ALLOWLIST_JSON must be a JSON array of addresses.");
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== "string" || !isHexAddress(entry)) {
      throw new MissingConfigError(
        `EXECUTION_TO_ADDRESS_ALLOWLIST_JSON contains invalid address at index ${index}.`,
      );
    }
    return entry;
  });
};

const parseApprovalsAllowlist = (): string[] => {
  const raw = process.env.APPROVALS_ALLOWLIST_JSON?.trim();
  if (!raw || raw === "") {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MissingConfigError("APPROVALS_ALLOWLIST_JSON must be valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new MissingConfigError("APPROVALS_ALLOWLIST_JSON must be a JSON array of addresses.");
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== "string" || !isHexAddress(entry)) {
      throw new MissingConfigError(`APPROVALS_ALLOWLIST_JSON contains invalid address at index ${index}.`);
    }
    return entry;
  });
};

const parseChainIdListEnv = (name: "ACCESS_PASS_ACCEPTED_CHAINS"): number[] => {
  const entries = parseCsvEnv(name);
  if (entries.length === 0) {
    return [];
  }

  return entries.map((entry) => {
    const parsed = Number(entry);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new MissingConfigError(`${name} must contain comma-separated positive integer chain IDs.`);
    }
    return parsed;
  });
};

const parseContractsByChainEnv = (
  raw?: string,
): Record<number, string> => {
  if (!raw || raw.trim() === "") {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MissingConfigError("ACCESS_PASS_CONTRACTS_JSON must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new MissingConfigError("ACCESS_PASS_CONTRACTS_JSON must be an object map of chainId -> address.");
  }

  const output: Record<number, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const chainId = Number(key);
    if (!Number.isInteger(chainId) || chainId <= 0) {
      throw new MissingConfigError(`Invalid chain id in ACCESS_PASS_CONTRACTS_JSON: ${key}`);
    }
    if (typeof value !== "string" || !isHexAddress(value)) {
      throw new MissingConfigError(
        `Invalid contract address for chain ${key} in ACCESS_PASS_CONTRACTS_JSON.`,
      );
    }
    output[chainId] = value;
  }

  return output;
};

export const loadRuntimeConfig = (): RuntimeConfig => {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase() || "development";
  const logLevel = process.env.LOG_LEVEL?.trim();
  return {
    NODE_ENV: nodeEnv,
    LOG_LEVEL: logLevel && logLevel.length > 0 ? logLevel : undefined,
  };
};

export const loadConfig = (): AppConfig => {
  const minProfitGapRaw = requireEnv("MIN_PROFIT_GAP");
  const minProfitGap = Number(minProfitGapRaw);

  if (!Number.isFinite(minProfitGap)) {
    throw new MissingConfigError('MIN_PROFIT_GAP must be a valid number.');
  }

  const contractsByChain = parseContractsByChainEnv(parseOptionalTextEnv("ACCESS_PASS_CONTRACTS_JSON"));
  const singleChainId = parseOptionalIntegerEnv("ACCESS_PASS_CHAIN_ID");
  const singleContract = parseOptionalAddressEnv("ACCESS_PASS_CONTRACT_ADDRESS");
  if (singleChainId && singleContract) {
    contractsByChain[singleChainId] = singleContract;
  }

  const acceptedChainsFromEnv = parseChainIdListEnv("ACCESS_PASS_ACCEPTED_CHAINS");
  const acceptedChains = acceptedChainsFromEnv.length > 0 ? acceptedChainsFromEnv : Object.keys(contractsByChain).map(Number);
  const executionKillSwitchPath = process.env.KILL_SWITCH_FILE?.trim() || "./reports/KILL_SWITCH";
  const executionPrivateKey = parseOptionalExecutionPrivateKey();
  const executionEnabled = parseBooleanEnv("EXECUTION_ENABLED", false);
  if (executionEnabled && !executionPrivateKey) {
    throw new MissingConfigError("EXECUTION_ENABLED=true requires EXECUTION_PRIVATE_KEY in local env.");
  }

  return {
    ALCHEMY_URL: requireEnv("ALCHEMY_URL"),
    WALLET_PRIVATE_KEY: requireEnv("WALLET_PRIVATE_KEY"),
    TARGET_NETWORK: requireEnv("TARGET_NETWORK"),
    MIN_PROFIT_GAP: minProfitGap,
    RPC_FALLBACK_URLS: parseCsvEnv("RPC_FALLBACK_URLS"),
    ENABLE_REPORT_PERSISTENCE: parseBooleanEnv("ENABLE_REPORT_PERSISTENCE", false),
    CHAIN_ID: parseOptionalIntegerEnv("CHAIN_ID"),
    ACCESS_PASS_CHAIN_ID: singleChainId,
    ACCESS_PASS_CONTRACT_ADDRESS: singleContract,
    ACCESS_PASS_TOKEN_ID: parseIntegerEnvWithDefault("ACCESS_PASS_TOKEN_ID", 1, { min: 0 }),
    ACCESS_PASS_MIN_BALANCE: parseIntegerEnvWithDefault("ACCESS_PASS_MIN_BALANCE", 1, { min: 1 }),
    ENABLE_PREMIUM_MODE: parseBooleanEnv("ENABLE_PREMIUM_MODE", false),
    USER_WALLET_ADDRESS: parseOptionalAddressEnv("USER_WALLET_ADDRESS"),
    USER_LOGIN_SIGNATURE: parseOptionalTextEnv("USER_LOGIN_SIGNATURE"),
    PREMIUM_SIGNER_KEY: parseOptionalPremiumSignerKey(),
    APP_SIGNER_KEY: parseOptionalPremiumSignerKey(),
    PREMIUM_PACKAGE_TTL_SECONDS: parseIntegerEnvWithDefault("PREMIUM_PACKAGE_TTL_SECONDS", 60, { min: 1 }),
    PREMIUM_PACKAGE_VERSION: parseIntegerEnvWithDefault("PREMIUM_PACKAGE_VERSION", 1, { min: 1 }),
    PREMIUM_MAX_PACKAGES_PER_HOUR: parseIntegerEnvWithDefault("PREMIUM_MAX_PACKAGES_PER_HOUR", 30, { min: 1 }),
    PREMIUM_RATE_LIMIT_WINDOW_SECONDS: parseIntegerEnvWithDefault("PREMIUM_RATE_LIMIT_WINDOW_SECONDS", 3600, {
      min: 1,
    }),
    IPFS_UPLOAD_URL: parseOptionalTextEnv("IPFS_UPLOAD_URL"),
    IPFS_AUTH_TOKEN: parseOptionalTextEnv("IPFS_AUTH_TOKEN"),
    ENABLE_PUBLIC_SUMMARY_PUBLISH: parseBooleanEnv("ENABLE_PUBLIC_SUMMARY_PUBLISH", false),
    ENABLE_DISCORD_ALERTS: parseBooleanEnv("ENABLE_DISCORD_ALERTS", false),
    DISCORD_BOT_TOKEN: parseOptionalTextEnv("DISCORD_BOT_TOKEN"),
    DISCORD_CHANNEL_ID: parseOptionalTextEnv("DISCORD_CHANNEL_ID"),
    DISCORD_ALERTS_MIN_INTERVAL_SECONDS: parseIntegerEnvWithDefault("DISCORD_ALERTS_MIN_INTERVAL_SECONDS", 60, {
      min: 1,
    }),
    ENABLE_TELEGRAM_ALERTS: parseBooleanEnv("ENABLE_TELEGRAM_ALERTS", false),
    TELEGRAM_BOT_TOKEN: parseOptionalTextEnv("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_CHAT_ID: parseOptionalTextEnv("TELEGRAM_CHAT_ID"),
    TELEGRAM_ALERTS_MIN_INTERVAL_SECONDS: parseIntegerEnvWithDefault("TELEGRAM_ALERTS_MIN_INTERVAL_SECONDS", 60, {
      min: 1,
    }),
    ENABLE_PUBLIC_METRICS: parseBooleanEnv("ENABLE_PUBLIC_METRICS", false),
    ACCESS_PASS_MINT_PRICE_WEI: parseOptionalWeiEnv("ACCESS_PASS_MINT_PRICE_WEI"),
    ACCESS_PASS_ACCEPTED_CHAINS: acceptedChains,
    ACCESS_PASS_CONTRACTS_BY_CHAIN: contractsByChain,
    OPERATOR_INTERVAL_SECONDS: parseIntegerEnvWithDefault("OPERATOR_INTERVAL_SECONDS", 30, { min: 1 }),
    OPERATOR_ENABLE: parseBooleanEnv("OPERATOR_ENABLE", false),
    OPERATOR_MAX_TICKS: parseIntegerEnvWithDefault("OPERATOR_MAX_TICKS", 0, { min: 0 }),
    OPERATOR_JITTER_MS: parseIntegerEnvWithDefault("OPERATOR_JITTER_MS", 500, { min: 0 }),
    RPC_MAX_CONCURRENCY: parseIntegerEnvWithDefault("RPC_MAX_CONCURRENCY", 2, { min: 1 }),
    RPC_RETRY_MAX: parseIntegerEnvWithDefault("RPC_RETRY_MAX", 2, { min: 0 }),
    RPC_RETRY_BACKOFF_MS: parseIntegerEnvWithDefault("RPC_RETRY_BACKOFF_MS", 250, { min: 0 }),
    RPC_TIMEOUT_MS: parseIntegerEnvWithDefault("RPC_TIMEOUT_MS", 8000, { min: 1 }),
    EXECUTION: {
      ENABLED: executionEnabled,
      CHAIN_ID: parseIntegerEnvWithDefault("EXECUTION_CHAIN_ID", 8453, { min: 1 }),
      PRIVATE_KEY: executionPrivateKey,
      APPROVALS_ENABLED: parseBooleanEnv("APPROVALS_ENABLED", false),
      APPROVALS_MAX_AMOUNT: parseDecimalEnvWithDefault("APPROVALS_MAX_AMOUNT", 0, { min: 0 }),
      APPROVALS_ALLOWLIST: parseApprovalsAllowlist(),
      MAX_TRADE_ETH: parseDecimalEnvWithDefault("EXECUTION_MAX_TRADE_ETH", 0.02, { min: 0 }),
      MAX_GAS_GWEI: parseDecimalEnvWithDefault("EXECUTION_MAX_GAS_GWEI", 5, { min: 0 }),
      MAX_SLIPPAGE_BPS: parseIntegerEnvWithDefault("EXECUTION_MAX_SLIPPAGE_BPS", 30, { min: 0 }),
      MIN_NET_PROFIT_ETH: parseDecimalEnvWithDefault("EXECUTION_MIN_NET_PROFIT_ETH", 0.002, { min: 0 }),
      DAILY_LOSS_LIMIT_ETH: parseDecimalEnvWithDefault("EXECUTION_DAILY_LOSS_LIMIT_ETH", 0.01, { min: 0 }),
      COOLDOWN_SECONDS: parseIntegerEnvWithDefault("EXECUTION_COOLDOWN_SECONDS", 30, { min: 0 }),
      REPLAY_WINDOW_SECONDS: parseIntegerEnvWithDefault("EXECUTION_REPLAY_WINDOW_SECONDS", 3600, { min: 1 }),
      ALLOW_REPLAY: parseBooleanEnv("EXECUTION_ALLOW_REPLAY", false),
      PENDING_TIMEOUT_SECONDS: parseIntegerEnvWithDefault("EXECUTION_PENDING_TIMEOUT_SECONDS", 180, { min: 1 }),
      MAX_CONSECUTIVE_SEND_FAILS: parseIntegerEnvWithDefault("EXECUTION_MAX_CONSECUTIVE_SEND_FAILS", 3, { min: 1 }),
      TO_ADDRESS_ALLOWLIST: parseExecutionAllowlist(),
      KILL_SWITCH_FILE: executionKillSwitchPath,
    },
  };
};
