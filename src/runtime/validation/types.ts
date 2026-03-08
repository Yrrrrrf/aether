/**
 * Represents an interface for validating request responses (typically satisfied by Zod types).
 */
// deno-lint-ignore no-explicit-any
export interface ValidationStrategy<T = any> {
  /**
   * Parses and validates unknown data, throwing an error if invalid, or returning the typed value.
   * @param data - The data to validate.
   */
  parse(data: unknown): T;
}
