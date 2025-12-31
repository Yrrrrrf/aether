export type ProxyCallback = (
  path: string[],
  args: unknown[],
) => Promise<unknown>;

export function createRecursiveProxy(
  callback: ProxyCallback,
  path: string[] = [],
): unknown {
  return new Proxy(() => {}, {
    get(_target, prop) {
      if (typeof prop === "string") {
        if (prop === "then") return undefined; // Avoid Promise wrapping issues
        return createRecursiveProxy(callback, [...path, prop]);
      }
      return undefined;
    },
    apply(_target, _thisArg, args) {
      return callback(path, args);
    },
  });
}
