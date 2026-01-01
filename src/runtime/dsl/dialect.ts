import type { QueryFilter, QueryOptions } from "./types.ts";
import { OPERATOR_MAP } from "./operators.ts";
import { ValidationError } from "../transport/errors.ts";

function encodeValue(val: unknown): string {
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (val === null) return "null";
  if (typeof val === "string") return encodeURIComponent(val);
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "bigint") return String(val);

  if (Array.isArray(val)) {
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

    if (key === "$or" || key === "$and") {
      if (Array.isArray(value)) {
        const subParts = value.map((sub) => {
          const processed = processFilter(sub as QueryFilter);
          return processed.join(",");
        }).join(",");

        // pREST logical ops usually don't need $ in the URL key itself if used as ?_or=...
        // But inside filters, standard pREST is tricky.
        // We will adhere to the provided map: $or -> or=(...)
        // pREST docs aren't explicit on complex AND/OR syntax deep dive,
        // but often follow PostgREST loose standards.
        const op = key.replace("$", "");
        parts.push(`${op}=(${subParts})`);
      }
      continue;
    }

    if (key === "$not") continue;

    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      const keys = Object.keys(value);
      const isOperatorNode = keys.every((k) => k.startsWith("$"));

      if (isOperatorNode) {
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
                  const escaped = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
                  return `"${encodeURIComponent(escaped)}"`;
                }
                return encoded;
              }).join(",");

              if (config.format === "parens") formattedVal = `(${joined})`;
              else if (config.format === "braces") formattedVal = `{${joined}}`;
              else formattedVal = joined;
            } else {
              formattedVal = encodeValue(opVal);
            }

            parts.push(`${currentPath}=${config.token}.${formattedVal}`);
          }
        }
      } else {
        parts.push(...processFilter(value as QueryFilter, currentPath));
      }
    } else {
      // pREST default equality: field=$eq.value
      parts.push(`${currentPath}=$eq.${encodeValue(value)}`);
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
  if (query?.select) params.push(`_select=${query.select.join(",")}`);

  // 2. FILTER
  if (query?.where) params.push(...processFilter(query.where));

  // 3. ORDER
  if (query?.order) {
    if (Array.isArray(query.order)) {
      params.push(`_order=${query.order.join(",")}`);
    } else if (typeof query.order === "object") {
      const orders = Object.entries(query.order).map(([k, v]) =>
        v === "desc" ? `-${k}` : k
      );
      params.push(`_order=${orders.join(",")}`);
    }
  }

  // 4. PAGINATION (CRITICAL FIX)
  if (query?.limit) {
    params.push(`_page_size=${query.limit}`);
    // pREST requires _page if _page_size is present
    if (!query.offset) params.push(`_page=1`);
  }

  if (query?.offset) {
    const limit = query.limit || 10;
    const page = Math.floor(query.offset / limit) + 1;
    params.push(`_page=${page}`);
  }

  const queryString = params.join("&");
  return `/${schema}/${table}${queryString ? "?" + queryString : ""}`;
}
