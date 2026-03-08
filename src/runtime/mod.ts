export { type AetherConfig, createAether } from "./core/fabric.ts";
export { createAetherPool, type Pool } from "./core/pool.ts";

export type { AuthProvider } from "./auth/types.ts";
export { apiKeyAdapter } from "./auth/adapters.ts";

export {
  type QueryFilter,
  type QueryOptions,
  type TableOperations,
  type ViewOperations,
} from "./dsl/types.ts";

export {
  AetherError,
  ApiError,
  NetworkError,
  ValidationError,
} from "./transport/errors.ts";

export type { ValidationStrategy } from "./validation/types.ts";
