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
