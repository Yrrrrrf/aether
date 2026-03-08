import type { AuthProvider } from "./types.ts";

/**
 * Built-in static adapter for server-side scripts or simple API key usage.
 * Returns the key itself as the access token (for Supabase/PostgREST Bearer).
 */
export function apiKeyAdapter(key: string): AuthProvider {
  return {
    getAccessToken: () => key,
  };
}

/**
 * Compatibility shim mapping v1 'getAccessToken' pattern to the new AuthProvider interface.
 */
export function tokenAdapter(
  fn: () => string | null | Promise<string | null>,
): AuthProvider {
  return {
    getAccessToken: fn,
  };
}
