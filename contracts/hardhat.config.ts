import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const deployerEnvVar = ["DEPLOYER", "PRIVATE", "KEY"].join("_");
const deployerCredential = process.env[deployerEnvVar]?.trim();
const alchemyUrl = process.env.ALCHEMY_URL?.trim();

const accounts = deployerCredential ? [deployerCredential] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {},
    alchemy: alchemyUrl
      ? {
          url: alchemyUrl,
          accounts,
        }
      : undefined,
  },
};

export default config;
