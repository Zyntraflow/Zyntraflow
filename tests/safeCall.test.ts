import { describe, expect, it } from "vitest";
import { retry, TimeoutError, withTimeout } from "../src/rpc/safeCall";

describe("safeCall", () => {
  it("resolves values before timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000);
    expect(result).toBe("ok");
  });

  it("throws TimeoutError when call exceeds timeout", async () => {
    await expect(
      withTimeout(
        new Promise((resolve) => {
          setTimeout(() => resolve("late"), 25);
        }),
        1,
      ),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("retries transient failures and succeeds", async () => {
    let attempts = 0;
    const value = await retry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("temporary");
        }
        return "done";
      },
      {
        max: 3,
        backoffMs: 0,
      },
    );

    expect(value).toBe("done");
    expect(attempts).toBe(3);
  });

  it("returns sanitized error when retries are exhausted", async () => {
    await expect(
      retry(
        async () => {
          throw new Error("request failed https://arb-mainnet.g.alchemy.com/v2/abc123?key=x");
        },
        {
          max: 1,
          backoffMs: 0,
        },
      ),
    ).rejects.toThrow("[REDACTED]");
  });
});
