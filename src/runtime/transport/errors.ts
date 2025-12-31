export class AetherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AetherError";
  }
}

export class NetworkError extends AetherError {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = "NetworkError";
  }
}

export class ApiError extends AetherError {
  constructor(
    public readonly statusCode: number,
    public readonly statusText: string,
    public readonly body: unknown,
  ) {
    super(`API Error ${statusCode}: ${statusText}`);
    this.name = "ApiError";
  }
}

export class ValidationError extends AetherError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
