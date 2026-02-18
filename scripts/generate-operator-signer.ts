import fs from "fs";
import path from "path";
import { Wallet } from "ethers";

const ENV_FILE = path.join(process.cwd(), ".env.operator");
const KEY_NAME = "PREMIUM_SIGNER_PRIVATE_KEY";

const ensureTrailingNewline = (value: string): string => (value.endsWith("\n") ? value : `${value}\n`);

const upsertEnvValue = (content: string, key: string, value: string): string => {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, `${key}=${value}`);
  }

  const normalized = ensureTrailingNewline(content);
  return `${normalized}${key}=${value}\n`;
};

const createTemplate = (): string => {
  return [
    "# Local operator secrets. Never commit.",
    "# Operator signer is only for signing feeds/packages. NOT for trading.",
    "",
  ].join("\n");
};

const wallet = Wallet.createRandom();
const privateKey = wallet.privateKey;

const existingContent = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : createTemplate();
const updatedContent = upsertEnvValue(existingContent, KEY_NAME, privateKey);

fs.writeFileSync(ENV_FILE, updatedContent, { encoding: "utf8", flag: "w" });

try {
  fs.chmodSync(ENV_FILE, 0o600);
} catch {
  // Best effort: Windows may not support chmod semantics.
}

process.stdout.write(`Operator signer address: ${wallet.address}\n`);
process.stdout.write("Private key written to .env.operator (local only, gitignored)\n");
