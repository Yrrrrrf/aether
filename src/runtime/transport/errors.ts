/**
 * Base class for all Aether-specific errors.
 */
export class AetherError extends Error {
  /**
   * Constructs a new AetherError.
   * @param message - The error message.
   */
  constructor(message: string) {
    super(message);
    this.name = "AetherError";
  }
}

/**
 * Thrown when a network request fails entirely (e.g. CORS, offline).
 */
export class NetworkError extends AetherError {
  /**
   * Constructs a new NetworkError.
   * @param message - The network error message.
   * @param originalError - The underlying caught exception, if any.
   */
  constructor(
    /** The network error message. */
    message: string,
    /** The underlying caught exception, if any. */
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "NetworkError";
  }
}

/**
 * Thrown when the backend API returns a non-success HTTP status code.
 */
export class ApiError extends AetherError {
  /**
   * Constructs a new ApiError.
   * @param statusCode - The HTTP status code returned.
   * @param statusText - The HTTP status text returned.
   * @param body - The API response body, if any.
   */
  constructor(
    /** The HTTP status code returned. */
    public readonly statusCode: number,
    /** The HTTP status text returned. */
    public readonly statusText: string,
    /** The API response body, if any. */
    public readonly body: unknown,
  ) {
    super(`API Error ${statusCode}: ${statusText}`);
    this.name = "ApiError";
  }
}

/**
 * Thrown when client-side validation logic fails.
 */
export class ValidationError extends AetherError {
  /**
   * Constructs a new ValidationError.
   * @param message - The validation error message.
   */
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Thrown when trying to mutate a view.
 */
export class ViewMutationError extends AetherError {
  constructor(schema: string, table: string) {
    super(
      `Cannot mutate "${schema}.${table}": this is a read-only database view.\n` +
        `Hint: Use findMany() or findOne() to query this view.`,
    );
    this.name = "ViewMutationError";
  }
}

/**
 * Thrown when required primary key fields are missing in an update/delete filter.
 */
export class MissingPrimaryKeyError extends AetherError {
  constructor(schema: string, table: string, requiredKeys: string[]) {
    super(
      `Missing required primary key(s) in filter for "${schema}.${table}".\n` +
        `Required: ${requiredKeys.map((k) => `"${k}"`).join(", ")}\n` +
        `Hint: Update/delete filters must include all primary key columns ` +
        `to prevent accidental full-table mutations.`,
    );
    this.name = "MissingPrimaryKeyError";
  }
}

/**
 * Thrown when calling an unknown RPC function.
 */
export class UnknownRpcError extends AetherError {
  constructor(fnName: string, available: string[]) {
    super(
      `Unknown RPC function: "${fnName}".\n` +
        `Available functions: ${available.join(", ")}\n` +
        `Hint: Re-run "deno task generate" if you've added new database functions.`,
    );
    this.name = "UnknownRpcError";
  }
}
