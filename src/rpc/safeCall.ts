export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export type RetryOptions = {
  max: number;
  backoffMs: number;
  jitterMs?: number;
};

export const sanitizeRpcErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/v2\/)([^/\s?#]+)/gi, "$1[REDACTED]")
    .replace(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, "[REDACTED_HEX_64]");
};

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = "RPC call timed out",
): Promise<T> => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new TimeoutError(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const computeDelayMs = (attempt: number, backoffMs: number, jitterMs: number): number => {
  const expo = backoffMs * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
  return expo + jitter;
};

export const retry = async <T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> => {
  const maxRetries = Math.max(0, options.max);
  const backoffMs = Math.max(0, options.backoffMs);
  const jitterMs = Math.max(0, options.jitterMs ?? 0);

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) {
        break;
      }
      const waitMs = computeDelayMs(attempt + 1, backoffMs, jitterMs);
      await delay(waitMs);
    }
  }

  throw lastError instanceof Error
    ? new Error(sanitizeRpcErrorMessage(lastError))
    : new Error(sanitizeRpcErrorMessage(String(lastError)));
};
