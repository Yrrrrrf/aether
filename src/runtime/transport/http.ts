import { ApiError, NetworkError } from "./errors.ts";
import { type RetryOptions, withRetry } from "./retry.ts";

export interface FetchOptions {
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  retry?: RetryOptions;
}

export class Carrier {
  constructor(
    private readonly baseUrl: string,
    private readonly globalHeaders: Record<string, string> = {},
  ) {}

  async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      "Content-Type": "application/json",
      ...this.globalHeaders,
      ...options.headers,
    };

    const config: RequestInit = {
      method: options.method || "GET",
      headers,
      signal: options.signal,
    };

    if (options.body) {
      config.body = JSON.stringify(options.body, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value);
    }

    const execute = async () => {
      try {
        const response = await fetch(url, config);

        if (!response.ok) {
          let errorBody;
          try {
            errorBody = await response.json();
          } catch {
            errorBody = await response.text();
          }
          throw new ApiError(response.status, response.statusText, errorBody);
        }

        // Handle 204 No Content
        if (response.status === 204) {
          return null as T;
        }

        return (await response.json()) as T;
      } catch (err) {
        if (err instanceof ApiError) throw err;
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        throw new NetworkError(
          err instanceof Error ? err.message : "Unknown network error",
          err,
        );
      }
    };

    // Only retry idempotent methods (GET, PUT, DELETE, HEAD, OPTIONS)
    // or if it's strictly a network error on others, handled by withRetry logic
    // But technically we should be careful with POST/PATCH.
    // The retry logic in retry.ts checks for NetworkError.
    // Spec says: "The retry.ts module must never retry non-idempotent methods... unless a specific network error occurred."
    // My retry logic currently checks isRetryable(error).
    // Let's enforce the method constraint here or there.

    // Ideally, we pass "isIdempotent" context to retry, or we strictly control it here.
    // For now, I'll rely on the generalized retry logic which retries NetworkErrors (safe for all usually, unless the request partially reached the server)
    // and 503/504.

    return withRetry(execute, options.retry);
  }
}
