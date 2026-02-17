import { assertNoSecretLeaks } from "./security";

const runPreflight = (): void => {
  try {
    assertNoSecretLeaks(process.cwd());
    console.log("PASS: No secret leaks detected.");
  } catch (error) {
    console.error("FAIL: Secret leak check failed.");
    const message = error instanceof Error ? error.message : "Unknown preflight error.";
    console.error(message);
    process.exit(1);
  }
};

runPreflight();
