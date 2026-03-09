import { ResponseError, up } from "npm:up-fetch@^2.5.1";
import type { AetherConfig } from "../core/fabric.ts";
import { ApiError, NetworkError } from "./errors.ts";

/**
 * Options for configuring an individual fetch request via the transport layer.
 */
export type FetchOptions = {
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Resolves standard authorization and profile headers for API requests.
 * Evaluates the API key, fetches JWTs dynamically, and sets schema profile routing.
 *
 * @param config - The initial Aether configuration object.
 * @returns A record of HTTP headers to append to requests.
 */
export async function resolveClientHeaders(
  config: AetherConfig,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.headers,
  };

  if (config.apiKey) {
    headers["apikey"] = config.apiKey;
  }

  if (config.auth) {
    const token = await config.auth.getAccessToken();
    if (token !== null) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  if (config.schema && config.schema !== "public") {
    headers["Accept-Profile"] = config.schema;
    headers["Content-Profile"] = config.schema;
  }

  return headers;
}

/**
 * Constructs the core fetch transport layer with built-in retry logic,
 * BigInt precision safety, token refresh handling, and error mapping.
 *
 * @param config - The Aether configuration object mapping API locations and keys.
 * @returns A strictly typed fetch executing function managing interceptors seamlessly.
 */
export function buildTransport(config: AetherConfig) {
  const upFetch = up(fetch, async () => {
    const headers = await resolveClientHeaders(config);

    return {
      baseUrl: config.baseUrl,
      headers,
      retries: 3,
      retryDelay: (attempt: number) => {
        let delay = Math.min(200 * Math.pow(2, attempt), 2000);
        delay = delay * (0.5 + Math.random());
        return delay;
      },
      // deno-lint-ignore no-explicit-any
      retryOn: (error: any) => {
        if (error instanceof ResponseError) {
          return error.response.status === 503 || error.response.status === 504;
        }
        return true;
      },
      // deno-lint-ignore no-explicit-any
      serialize: (body: any) =>
        JSON.stringify(
          body,
          (_, v) => typeof v === "bigint" ? v.toString() : v,
        ),
      parseResponse: async (response: Response) => {
        if (response.status === 204) return null;
        const text = await response.text();
        if (!text) return null;

        // Safe BigInt Parsing
        const safeText = text.replace(/"([^"]+)":\s*(\d{15,})/g, '"$1": "$2"');
        const data = JSON.parse(safeText);

        const contentRange = response.headers.get("Content-Range");
        if (contentRange) {
          const match = contentRange.match(/\/(\d+|\*)$/);
          if (match && match[1] !== "*") {
            return { data, count: parseInt(match[1], 10) };
          }
        }

        return data;
      },
    };
  });

  return async <T>(path: string, options: FetchOptions = {}): Promise<T> => {
    let attempt = 0;
    while (true) {
      try {
        // We pass the path; baseUrl is handled by up-fetch
        // options body will be auto-serialized
        // deno-lint-ignore no-explicit-any
        return (await upFetch(path, options as any)) as T;
      } catch (err) {
        // deno-lint-ignore no-explicit-any
        const error = err as any;

        // Handle 401 token refresh proactively
        if (
          error instanceof ResponseError &&
          error.response.status === 401 &&
          config.auth?.onTokenRefresh &&
          attempt === 0
        ) {
          attempt++;
          try {
            const refreshPromise = new Promise<void>((resolve, reject) => {
              try {
                const res = config.auth!.onTokenRefresh!(() => resolve());
                if (res instanceof Promise) {
                  res.then(resolve).catch(reject);
                }
              } catch (e) {
                reject(e);
              }
            });
            const timeoutPromise = new Promise<void>((_, reject) =>
              setTimeout(
                () => reject(new Error("Token refresh timed out")),
                10000,
              )
            );
            await Promise.race([refreshPromise, timeoutPromise]);
            // Retry the request loop by continuing
            continue;
          } catch (_refreshErr) {
            // Throw original 401 if refresh fails or times out
            throw new ApiError(
              error.response.status,
              error.response.statusText,
              error.data ?? await error.response.text().catch(() => ""),
            );
          }
        }

        if (error instanceof ResponseError) {
          throw new ApiError(
            error.response.status,
            error.response.statusText,
            error.data ?? await error.response.text().catch(() => ""),
          );
        }
        if (error instanceof ApiError || error instanceof NetworkError) {
          throw error;
        }
        throw new NetworkError(
          error instanceof Error ? error.message : "Unknown",
          error,
        );
      }
    }
  };
}
