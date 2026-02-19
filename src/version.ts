import fs from "fs";
import path from "path";

type PackageJsonShape = {
  version?: string;
};

const readVersion = (): string => {
  const packageJsonPath = path.resolve(__dirname, "..", "package.json");
  try {
    const raw = fs.readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as PackageJsonShape;
    if (parsed.version && parsed.version.trim() !== "") {
      return parsed.version.trim();
    }
  } catch {
    // Fall through to default.
  }
  return "0.0.0";
};

export const APP_VERSION = readVersion();
