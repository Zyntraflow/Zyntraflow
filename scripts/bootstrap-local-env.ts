import fs from "fs";
import path from "path";
import { Wallet } from "ethers";

const ENV_PATH = path.join(process.cwd(), ".env");

const WALLET_PRIVATE_KEY_NAME = ["WALLET", "PRIVATE", "KEY"].join("_");
const TARGET_NETWORK_NAME = "TARGET_NETWORK";
const MIN_PROFIT_GAP_NAME = "MIN_PROFIT_GAP";
const ALCHEMY_URL_NAME = "ALCHEMY_URL";

type EnvDoc = {
  lines: string[];
  keyToLineIndex: Map<string, number>;
  keyToValue: Map<string, string>;
};

const ENV_LINE_REGEX = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/;

const parseEnvDoc = (content: string): EnvDoc => {
  const lines = content.split(/\r?\n/);
  const keyToLineIndex = new Map<string, number>();
  const keyToValue = new Map<string, string>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(ENV_LINE_REGEX);
    if (!match) {
      continue;
    }

    const key = match[1];
    const value = match[2] ?? "";
    keyToLineIndex.set(key, i);
    keyToValue.set(key, value.trim());
  }

  return {
    lines,
    keyToLineIndex,
    keyToValue,
  };
};

const createInitialEnvDoc = (): EnvDoc => {
  return parseEnvDoc("# Local secrets file. Never commit.\n");
};

const getValue = (doc: EnvDoc, key: string): string => {
  return doc.keyToValue.get(key)?.trim() ?? "";
};

const setValue = (doc: EnvDoc, key: string, value: string): void => {
  const line = `${key}=${value}`;
  const existingIndex = doc.keyToLineIndex.get(key);
  if (existingIndex !== undefined) {
    doc.lines[existingIndex] = line;
  } else {
    if (doc.lines.length > 0 && doc.lines[doc.lines.length - 1] !== "") {
      doc.lines.push("");
    }
    doc.lines.push(line);
    doc.keyToLineIndex.set(key, doc.lines.length - 1);
  }
  doc.keyToValue.set(key, value);
};

const writeEnvDoc = (doc: EnvDoc): void => {
  const normalized = `${doc.lines.join("\n").replace(/\n+$/g, "\n")}`;
  fs.writeFileSync(ENV_PATH, normalized, { encoding: "utf8" });
};

const isArbitrumAlchemyUrl = (value: string): boolean => /(arbitrum|arb-mainnet|arb-sepolia)/i.test(value);

const main = (): void => {
  const exists = fs.existsSync(ENV_PATH);
  const doc = exists ? parseEnvDoc(fs.readFileSync(ENV_PATH, "utf8")) : createInitialEnvDoc();

  let generatedAddress: string | null = null;

  if (!getValue(doc, WALLET_PRIVATE_KEY_NAME)) {
    const wallet = Wallet.createRandom();
    setValue(doc, WALLET_PRIVATE_KEY_NAME, wallet.privateKey);
    generatedAddress = wallet.address;
  }

  if (!getValue(doc, TARGET_NETWORK_NAME)) {
    const alchemyUrl = getValue(doc, ALCHEMY_URL_NAME);
    const inferredNetwork = isArbitrumAlchemyUrl(alchemyUrl) ? "arbitrum" : "base";
    setValue(doc, TARGET_NETWORK_NAME, inferredNetwork);
  }

  if (!getValue(doc, MIN_PROFIT_GAP_NAME)) {
    setValue(doc, MIN_PROFIT_GAP_NAME, "0.01");
  }

  writeEnvDoc(doc);

  if (generatedAddress) {
    process.stdout.write(`Generated dev wallet address: ${generatedAddress}\n`);
  }

  if (!getValue(doc, ALCHEMY_URL_NAME)) {
    process.stderr.write("ALCHEMY_URL is missing in local .env. Set it before running dev/operator.\n");
    process.exit(1);
  }
};

main();
