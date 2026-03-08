import type { QueryFilter, QueryOptions } from "../dsl/types.ts";
import { POSTGREST_OPERATORS } from "../dsl/operators.ts";
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

function serializeNode(
  key: string,
  value: unknown,
  mode: "top-level" | "grouped",
  prefix = "",
): string[] {
  const parts: string[] = [];
  const currentPath = prefix ? `${prefix}.${key}` : key;

  if (key === "$or" || key === "$and") {
    if (Array.isArray(value)) {
      const subParts = value.map((sub) => {
        return serializeGrouped(sub as QueryFilter);
      }).join(",");

      const op = key.replace("$", "");

      if (mode === "top-level") {
        parts.push(`${op}=(${subParts})`);
      } else {
        parts.push(`${op}=(${subParts})`);
      }
    }
    return parts;
  }

  if (key === "$not") return parts;

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
        const config = POSTGREST_OPERATORS[opKey];

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

          if (mode === "top-level") {
            parts.push(`${currentPath}=${config.token}.${formattedVal}`);
          } else {
            parts.push(`${currentPath}.${config.token}.${formattedVal}`);
          }
        }
      }
    } else {
      for (const subKey in value as QueryFilter) {
        parts.push(
          ...serializeNode(
            subKey,
            (value as QueryFilter)[subKey],
            mode,
            currentPath,
          ),
        );
      }
    }
  } else {
    // Default to eq
    if (mode === "top-level") {
      parts.push(`${currentPath}=eq.${encodeValue(value)}`);
    } else {
      parts.push(`${currentPath}.eq.${encodeValue(value)}`);
    }
  }

  return parts;
}

export function serializeTopLevel(filter: QueryFilter): string[] {
  const parts: string[] = [];
  for (const key in filter) {
    parts.push(...serializeNode(key, filter[key], "top-level"));
  }
  return parts;
}

export function serializeGrouped(filter: QueryFilter): string {
  const parts: string[] = [];
  for (const key in filter) {
    parts.push(...serializeNode(key, filter[key], "grouped"));
  }
  return parts.join(",");
}

export function buildPostgrestUrl(
  table: string,
  query?: QueryOptions,
): string {
  const params: string[] = [];

  // 1. SELECT (with embedding)
  if (query?.select || query?.embed) {
    const selectParams = query.select
      ? [...query.select]
      : (query.embed ? ["*"] : []);
    if (query.embed) {
      for (const [rel, val] of Object.entries(query.embed)) {
        if (val === true) {
          selectParams.push(`${rel}(*)`);
        } else if (typeof val === "object") {
          const nestedSelect = val.select ? val.select.join(",") : "*";
          selectParams.push(`${rel}(${nestedSelect})`);
        }
      }
    }
    if (selectParams.length > 0) {
      params.push(`select=${selectParams.join(",")}`);
    }
  }

  // 2. FILTER
  if (query?.where) params.push(...serializeTopLevel(query.where));

  // 3. ORDER
  if (query?.order) {
    if (Array.isArray(query.order)) {
      params.push(`order=${query.order.join(",")}`);
    } else if (typeof query.order === "object") {
      const orders = Object.entries(query.order).map(([k, v]) => {
        if (typeof v === "string") {
          return `${k}.${v}`;
        } else if (typeof v === "object" && v !== null && "dir" in v) {
          let ord = `${k}.${v.dir}`;
          if (v.nulls) ord += `.nulls${v.nulls}`;
          return ord;
        }
        return `${k}.asc`;
      });
      params.push(`order=${orders.join(",")}`);
    }
  }

  // 4. PAGINATION
  if (query?.limit !== undefined) {
    params.push(`limit=${query.limit}`);
  }

  if (query?.offset !== undefined) {
    params.push(`offset=${query.offset}`);
  }

  const queryString = params.join("&");
  return `/${table}${queryString ? "?" + queryString : ""}`;
}
