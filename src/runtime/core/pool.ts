import type { AetherConfig } from "./fabric.ts";
import { createAether } from "./fabric.ts";
import type { AuthProvider } from "../auth/types.ts";

export type Pool<T> = T & {
  /**
   * Injects a shared AuthProvider into all pool clients simultaneously.
   * Useful when multiple backend databases share the same session/token.
   */
  setAuthProvider(auth: AuthProvider): void;
};

export function createAetherPool<T extends Record<string, unknown>>(
  configs: Record<keyof T, AetherConfig>,
): Pool<T> {
  const clients = {} as T;

  for (const key in configs) {
    // createAether reads `configs[key].auth` by reference during requests
    // deno-lint-ignore no-explicit-any
    clients[key] = createAether(configs[key]) as any;
  }

  const pool = clients as Pool<T>;

  Object.defineProperty(pool, "setAuthProvider", {
    value: (auth: AuthProvider) => {
      for (const key in configs) {
        configs[key].auth = auth;
      }
    },
    enumerable: false,
    writable: false,
  });

  return pool;
}
