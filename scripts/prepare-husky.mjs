import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const huskyPackagePath = path.join(process.cwd(), "node_modules", "husky", "package.json");

if (existsSync(huskyPackagePath)) {
  try {
    execSync("husky install", { stdio: "inherit" });
  } catch {
    process.exit(0);
  }
}

