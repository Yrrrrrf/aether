import type { QueryFilter, QueryOptions } from "./types.ts";
import { OPERATOR_MAP } from "./operators.ts";
import { ValidationError } from "../transport/errors.ts";

/**
 * Encodes a value for the URL.
 * pREST handles comma-separated lists for IN, etc.
 */
function encodeValue(val: unknown): string {
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (val === null) return "null";
  if (typeof val === "string") return encodeURIComponent(val);
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "bigint") return String(val);

  if (Array.isArray(val)) {
    // Recursive encoding for inner array values
    // Note: This does not wrap them in () or {}. The operator handler does that.
    // We just join them by comma here as a default or throw?
    // Actually, if we pass an array to encodeValue, it means we are encoding a list.
    // But the operator config decides parens vs braces.
    // So encodeValue should probably return the comma-separated string WITHOUT delimiters?
    // Or we should handle array mapping inside processFilter logic.
    // Let's assume processFilter handles the wrapping.
    // This function handles the *ELEMENT* encoding.
    // But if val IS an array (nested?), it's weird.
    // Let's throw for nested arrays for now, or just map.
    return val.map(encodeValue).join(",");
  }

  throw new ValidationError(`Unsupported value type: ${typeof val}`);
}

function processFilter(
  filter: QueryFilter,
  prefix = "",
): string[] {
  const parts: string[] = [];

  for (const key in filter) {
    const value = filter[key];
    const currentPath = prefix ? `${prefix}.${key}` : key;

    // Handle Logical Operators (_and, _or, _not)
    if (key === "$or" || key === "$and") {
      if (Array.isArray(value)) {
        // (cond1,cond2,...)
        const subParts = value.map((sub) => {
          // sub is a QueryFilter
          const processed = processFilter(sub as QueryFilter);
          return processed.join(",");
        }).join(",");

        const op = key.replace("$", "");
        parts.push(`${op}=(${subParts})`);
      }
      continue;
    }

    if (key === "$not") {
      // Logic for $not is complex, skipping strict implementation for now as agreed
      continue;
    }

    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Date) // Date is object but treated as scalar value
    ) {
      // It's a nested object. Check if keys are operators.
      const keys = Object.keys(value);
      const isOperatorNode = keys.every((k) => k.startsWith("$"));

      if (isOperatorNode) {
        // { age: { $gt: 5, $lt: 10 } } -> age=gt.5&age=lt.10
        for (const opKey of keys) {
          const opVal = (value as Record<string, unknown>)[opKey];
          const config = OPERATOR_MAP[opKey];

          if (config) {
            let formattedVal = "";

            if (Array.isArray(opVal)) {
              const isBraces = config.format === "braces";

              const joined = opVal.map((v) => {
                const encoded = encodeValue(v);
                if (isBraces && typeof v === "string") {
                  // Postgres Array Literal escaping
                  // We escape backslashes first, then quotes
                  // Note: We use the raw value 'v' for escaping logic to ensure
                  // we don't try to escape already-encoded characters, 
                  // but we encode the final result for URL safety.
                  const escaped = v
                    .replace(/\\/g, "\\\\")
                    .replace(/"/g, '\\"');
                  return `"${encodeURIComponent(escaped)}"`;
                }
                return encoded;
              }).join(",");

              if (config.format === "parens") {
                formattedVal = `(${joined})`;
              } else if (config.format === "braces") {
                formattedVal = `{${joined}}`;
              } else {
                formattedVal = joined;
              }
            } else {
              formattedVal = encodeValue(opVal);
            }

            parts.push(`${currentPath}=${config.token}.${formattedVal}`);
          }
        }
      } else {
        // It's a nested path: { user: { id: 5 } } -> user.id=eq.5
        parts.push(...processFilter(value as QueryFilter, currentPath));
      }
    } else {
      // Direct value equality: { id: 5 } -> id=eq.5
      parts.push(`${currentPath}=eq.${encodeValue(value)}`);
    }
  }

  return parts;
}

export function buildUrl(
  schema: string,
  table: string,
  query?: QueryOptions,
): string {
  const params: string[] = [];

  // 1. SELECT
  if (query?.select) {
    params.push(`select=${query.select.join(",")}`);
  }

  // 2. FILTER (WHERE)
  if (query?.where) {
    const filterParts = processFilter(query.where);
    params.push(...filterParts);
  }

  // 3. ORDER
  if (query?.order) {
    if (Array.isArray(query.order)) {
      params.push(`order=${query.order.join(",")}`);
    } else if (typeof query.order === "object") {
      // { age: "desc", name: "asc" } -> order=age.desc,name.asc
      const orders = Object.entries(query.order).map(([k, v]) => `${k}.${v}`);
      params.push(`order=${orders.join(",")}`);
    }
  }

  // 4. PAGINATION
  if (query?.limit) params.push(`limit=${query.limit}`);
  if (query?.offset) params.push(`offset=${query.offset}`);

  const queryString = params.join("&");
  return `/${schema}/${table}${queryString ? "?" + queryString : ""}`;
}
