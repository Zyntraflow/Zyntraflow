export type WatchdogSnapshot = {
  consecutiveFailures: number;
  lastBackoffMs: number;
  lastRestartAt: string | null;
};

export type WatchdogFailureResult = {
  snapshot: WatchdogSnapshot;
  restarted: boolean;
};

export type OperatorWatchdogOptions = {
  failureThreshold?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  closeProviders?: () => Promise<void> | void;
};

const defaultSleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class OperatorWatchdog {
  private consecutiveFailures = 0;
  private lastBackoffMs = 0;
  private lastRestartAt: string | null = null;
  private readonly failureThreshold: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly closeProviders: () => Promise<void> | void;

  constructor(options: OperatorWatchdogOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.baseBackoffMs = options.baseBackoffMs ?? 1000;
    this.maxBackoffMs = options.maxBackoffMs ?? 5 * 60 * 1000;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? (() => Date.now());
    this.closeProviders = options.closeProviders ?? (() => undefined);
  }

  private computeBackoffMs(): number {
    if (this.consecutiveFailures <= 0) {
      return 0;
    }

    const exponential = this.baseBackoffMs * 2 ** (this.consecutiveFailures - 1);
    return Math.min(this.maxBackoffMs, exponential);
  }

  getSnapshot(): WatchdogSnapshot {
    return {
      consecutiveFailures: this.consecutiveFailures,
      lastBackoffMs: this.lastBackoffMs,
      lastRestartAt: this.lastRestartAt,
    };
  }

  recordSuccess(): WatchdogSnapshot {
    this.consecutiveFailures = 0;
    this.lastBackoffMs = 0;
    return this.getSnapshot();
  }

  async recordFailureAndRecover(): Promise<WatchdogFailureResult> {
    this.consecutiveFailures += 1;
    this.lastBackoffMs = this.computeBackoffMs();

    let restarted = false;
    if (this.consecutiveFailures >= this.failureThreshold) {
      await this.closeProviders();
      this.lastRestartAt = new Date(this.now()).toISOString();
      restarted = true;
    }

    if (this.lastBackoffMs > 0) {
      await this.sleep(this.lastBackoffMs);
    }

    return {
      snapshot: this.getSnapshot(),
      restarted,
    };
  }
}

