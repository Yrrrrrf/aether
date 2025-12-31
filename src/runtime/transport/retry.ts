import { AetherError, ApiError, NetworkError } from "./errors.ts";

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitter?: boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 200,
  maxDelay: 2000,
  jitter: true,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (error instanceof ApiError) {
    // Retry on 503 (Service Unavailable) or 504 (Gateway Timeout)
    return error.statusCode === 503 || error.statusCode === 504;
  }
  return false;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt),
        opts.maxDelay,
      );

      if (opts.jitter) {
        delay = delay * (0.5 + Math.random());
      }

      await sleep(delay);
    }
  }

  throw lastError;
}
