import fs from "fs";
import path from "path";

const ensureParentDir = (filePath: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

export const isKillSwitchActive = (filePath: string): boolean => {
  return fs.existsSync(filePath);
};

export const createKillSwitch = (filePath: string): void => {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${new Date().toISOString()}\n`, { encoding: "utf8" });
};

export const removeKillSwitch = (filePath: string): void => {
  if (!fs.existsSync(filePath)) {
    return;
  }
  fs.unlinkSync(filePath);
};
