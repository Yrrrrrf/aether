// deno-lint-ignore no-explicit-any
export interface ValidationStrategy<T = any> {
  parse(data: unknown): T;
}
