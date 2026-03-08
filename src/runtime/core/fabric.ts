import { Carrier } from "../transport/http.ts";
import { createRecursiveProxy } from "./proxy.ts";
import { buildPostgrestUrl, buildUrl } from "../dsl/dialect.ts";
import type { QueryFilter, QueryOptions } from "../dsl/types.ts";
import { ValidationError } from "../transport/errors.ts";
import {
  isPostgrestDialect,
  resolveAuthHeaders,
  resolveWriteHeaders,
} from "../transport/auth.ts";

export interface AetherConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  dialect?: "prest" | "postgrest" | "supabase";
  apiKey?: string;
  getAccessToken?: () => string | null;
  schema?: string;
}

export function createAether<DB>(config: AetherConfig): DB {
  const isPostgrest = isPostgrestDialect(config);
  const carrier = new Carrier(config.baseUrl, () => resolveAuthHeaders(config));
  const writeHeaders = resolveWriteHeaders(config);

  return createRecursiveProxy(async (path, args) => {
    // Split-Brain Routing: Plugins / RPC
    // pREST uses /_plugins/, PostgREST uses /rpc/
    if (isPostgrest) {
      if (path.length >= 2) {
        const lastSegment = path[path.length - 1];
        const CRUD_METHODS = new Set([
          "findMany",
          "findOne",
          "create",
          "update",
          "delete",
        ]);
        if (!CRUD_METHODS.has(lastSegment)) {
          const fnName = lastSegment;
          const payload = args[0];
          return carrier.request(`/rpc/${fnName}`, {
            method: "POST",
            body: payload,
          });
        }
      }
    } else {
      if (path[0] === "_plugins") {
        const namespace = path[1];
        const fnName = path[2];
        const payload = args[0];
        return carrier.request(`/_plugins/${namespace}/${fnName}`, {
          method: "POST",
          body: payload,
        });
      }
    }

    if (path.length < 3) throw new Error(`Invalid path: ${path.join(".")}`);

    const method = path[path.length - 1];
    const table = path[path.length - 2];
    const schema = path[path.length - 3];

    switch (method) {
      case "findMany": {
        const options = args[0] as QueryOptions | undefined;
        const url = isPostgrest
          ? buildPostgrestUrl(table, options)
          : buildUrl(schema, table, options);
        return carrier.request(url, { method: "GET" });
      }
      case "findOne": {
        const options = args[0] as QueryOptions | undefined;
        // Force limit 1
        const url = isPostgrest
          ? buildPostgrestUrl(table, { ...options, limit: 1 })
          : buildUrl(schema, table, { ...options, limit: 1 });
        const result = await carrier.request<unknown[]>(url, { method: "GET" });

        // UNWRAP: Always return single object or null
        if (Array.isArray(result)) {
          return result.length > 0 ? result[0] : null;
        }
        return result;
      }
      case "create": {
        const data = args[0];
        const url = isPostgrest ? `/${table}` : `/${schema}/${table}`;
        const result = await carrier.request(url, {
          method: "POST",
          body: data,
          headers: writeHeaders,
        });

        // NORMALIZE: Ensure we always return an Array T[]
        if (result === null) return [];
        return Array.isArray(result) ? result : [result];
      }
      case "update": {
        const filter = args[0] as QueryFilter;
        const data = args[1];
        if (!filter || Object.keys(filter).length === 0) {
          throw new ValidationError("Missing filter");
        }

        const url = isPostgrest
          ? buildPostgrestUrl(table, { where: filter })
          : buildUrl(schema, table, { where: filter });

        const result = await carrier.request(url, {
          method: "PATCH",
          body: data,
          headers: writeHeaders,
        });

        // NORMALIZE: Ensure Array T[]
        if (result === null) return [];
        return Array.isArray(result) ? result : [result];
      }
      case "delete": {
        const filter = args[0] as QueryFilter;
        if (!filter || Object.keys(filter).length === 0) {
          throw new ValidationError("Missing filter");
        }

        const url = isPostgrest
          ? buildPostgrestUrl(table, { where: filter })
          : buildUrl(schema, table, { where: filter });

        return carrier.request(url, { method: "DELETE" });
      }
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }) as DB;
}
