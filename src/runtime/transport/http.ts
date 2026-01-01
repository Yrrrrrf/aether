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
      // BigInt Serialization (Outgoing)
      config.body = JSON.stringify(
        options.body,
        (_, v) => typeof v === "bigint" ? v.toString() : v,
      );
    }

    const execute = async () => {
      try {
        const response = await fetch(url, config);

        if (!response.ok) {
          throw new ApiError(
            response.status,
            response.statusText,
            await response.text(),
          );
        }

        if (response.status === 204) return null as T;

        const text = await response.text();
        if (!text) return null as T;

        // --- BIGINT SAFETY PATCH (Incoming) ---
        // Wraps numbers > 15 digits in quotes
        const safeText = text.replace(/"([^"]+)":\s*(\d{15,})/g, '"$1": "$2"');

        return JSON.parse(safeText) as T;
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new NetworkError(
          err instanceof Error ? err.message : "Unknown",
          err,
        );
      }
    };

    return withRetry(execute, options.retry);
  }
}
