import fs from "fs";
import path from "path";

export const PRIVATE_KEY_REGEX = /\b(?:0x)?[a-fA-F0-9]{64}\b/g;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type SecretMatch = {
  filePath: string;
  lineNumber: number;
};

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "reports",
  "public-feed",
  ".next",
  "artifacts",
  "cache",
  "typechain-types",
]);

const isEnvFile = (name: string): boolean => name === ".env" || name.startsWith(".env.");

const isBinaryBuffer = (buffer: Buffer): boolean => {
  const sampleLength = Math.min(buffer.length, 1024);
  for (let i = 0; i < sampleLength; i += 1) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
};

const shouldSkipFile = (fileName: string): boolean => {
  const baseName = path.basename(fileName);
  return isEnvFile(baseName);
};

const findSecretInText = (text: string): number | null => {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    PRIVATE_KEY_REGEX.lastIndex = 0;
    if (PRIVATE_KEY_REGEX.test(lines[index])) {
      return index + 1;
    }
  }
  return null;
};

const scanFileForSecret = (absolutePath: string, repoRoot: string): SecretMatch | null => {
  const stats = fs.statSync(absolutePath);
  if (!stats.isFile() || stats.size > MAX_FILE_SIZE_BYTES || shouldSkipFile(absolutePath)) {
    return null;
  }

  const buffer = fs.readFileSync(absolutePath);
  if (isBinaryBuffer(buffer)) {
    return null;
  }

  const lineNumber = findSecretInText(buffer.toString("utf8"));
  if (lineNumber === null) {
    return null;
  }

  return {
    filePath: path.relative(repoRoot, absolutePath),
    lineNumber,
  };
};

const walkDirectory = (absoluteDir: string, repoRoot: string, findings: SecretMatch[]): void => {
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "." || entry.name === "..") {
      continue;
    }

    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      walkDirectory(absolutePath, repoRoot, findings);
      continue;
    }

    const finding = scanFileForSecret(absolutePath, repoRoot);
    if (finding) {
      findings.push(finding);
    }
  }
};

export const scanRepositoryForSecrets = (repoRoot: string = process.cwd()): SecretMatch[] => {
  const findings: SecretMatch[] = [];
  walkDirectory(repoRoot, repoRoot, findings);
  return findings;
};

export const assertNoSecretLeaks = (repoRoot: string = process.cwd()): void => {
  const findings = scanRepositoryForSecrets(repoRoot);
  if (findings.length === 0) {
    return;
  }

  const details = findings
    .map(
      (finding) =>
        `Potential secret detected at ${finding.filePath}:${finding.lineNumber}. Move secrets to local .env only.`,
    )
    .join("\n");

  throw new Error(details);
};
