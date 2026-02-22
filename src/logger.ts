import pino from "pino";
import { loadRuntimeConfig } from "./config";

const runtime = loadRuntimeConfig();
const privateFieldName = ["WALLET", "PRIVATE", "KEY"].join("_");
const premiumSignerPrivateFieldName = ["PREMIUM", "SIGNER", "PRIVATE", "KEY"].join("_");
const premiumSignerFieldName = "PREMIUM_SIGNER_KEY";
const appSignerFieldName = "APP_SIGNER_KEY";
const userLoginSignatureName = "USER_LOGIN_SIGNATURE";
const ipfsAuthTokenName = "IPFS_AUTH_TOKEN";
const discordBotTokenName = "DISCORD_BOT_TOKEN";
const discordChannelIdName = "DISCORD_CHANNEL_ID";
const telegramBotTokenName = "TELEGRAM_BOT_TOKEN";
const telegramChatIdName = "TELEGRAM_CHAT_ID";
const executionPrivateKeyName = "EXECUTION_PRIVATE_KEY";

const redactPaths = [
  privateFieldName,
  `*.${privateFieldName}`,
  `config.${privateFieldName}`,
  premiumSignerPrivateFieldName,
  `*.${premiumSignerPrivateFieldName}`,
  `config.${premiumSignerPrivateFieldName}`,
  premiumSignerFieldName,
  `*.${premiumSignerFieldName}`,
  `config.${premiumSignerFieldName}`,
  appSignerFieldName,
  `*.${appSignerFieldName}`,
  `config.${appSignerFieldName}`,
  userLoginSignatureName,
  `*.${userLoginSignatureName}`,
  `config.${userLoginSignatureName}`,
  ipfsAuthTokenName,
  `*.${ipfsAuthTokenName}`,
  `config.${ipfsAuthTokenName}`,
  discordBotTokenName,
  `*.${discordBotTokenName}`,
  `config.${discordBotTokenName}`,
  discordChannelIdName,
  `*.${discordChannelIdName}`,
  `config.${discordChannelIdName}`,
  telegramBotTokenName,
  `*.${telegramBotTokenName}`,
  `config.${telegramBotTokenName}`,
  telegramChatIdName,
  `*.${telegramChatIdName}`,
  `config.${telegramChatIdName}`,
  executionPrivateKeyName,
  `*.${executionPrivateKeyName}`,
  `config.${executionPrivateKeyName}`,
  "authorization",
  "*.authorization",
  "ALCHEMY_URL",
  "*.ALCHEMY_URL",
  "config.ALCHEMY_URL",
];

const sanitizeString = (value: string): string => {
  return value
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/v2\/)([^/\s?#]+)/gi, "$1[REDACTED]")
    .replace(/(\/bot)([^/\s?#]+)/gi, "$1[REDACTED]")
    .replace(/\b0x[a-fA-F0-9]{130}\b/g, "[REDACTED_SIGNATURE]")
    .replace(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, "[REDACTED_HEX_64]");
};

const sanitizeValue = (value: unknown, seen: WeakSet<object>): unknown => {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key] = sanitizeValue(entry, seen);
    }
    return next;
  }

  return value;
};

const destination =
  runtime.NODE_ENV === "production"
    ? undefined
    : pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      });

export const logger = pino(
  {
    level: runtime.LOG_LEVEL || (runtime.NODE_ENV === "production" ? "info" : "debug"),
    redact: {
      paths: redactPaths,
      censor: "[REDACTED]",
    },
    hooks: {
      logMethod(args, method) {
        const seen = new WeakSet<object>();
        const sanitizedArgs = args.map((arg) => sanitizeValue(arg, seen));
        method.apply(this, sanitizedArgs as Parameters<typeof method>);
      },
    },
  },
  destination,
);
