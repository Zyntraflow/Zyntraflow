import { JsonRpcProvider } from "ethers";
import { MissingConfigError, loadConfig } from "./config";

const sanitizeErrorMessage = (error: unknown): string => {
  const rawMessage = error instanceof Error ? error.message : "Unknown error";
  return rawMessage.replace(/https?:\/\/\S+/gi, "[redacted-url]");
};

const main = async (): Promise<void> => {
  try {
    const config = loadConfig();
    const provider = new JsonRpcProvider(config.ALCHEMY_URL);
    await provider.getBlockNumber();
    console.log("Zyntraflow: Securely Linked");
  } catch (error) {
    if (error instanceof MissingConfigError) {
      console.error(
        "Missing .env or required environment variables. Copy .env.example to .env and fill values.",
      );
      process.exit(1);
    }

    console.error(`Connection failed: ${sanitizeErrorMessage(error)}`);
    process.exit(1);
  }
};

void main();
