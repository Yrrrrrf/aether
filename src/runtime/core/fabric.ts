import { Carrier } from "../transport/http.ts";
import { createRecursiveProxy } from "./proxy.ts";
import { buildUrl } from "../dsl/dialect.ts";
import type { QueryFilter, QueryOptions } from "../dsl/types.ts";
import { ValidationError } from "../transport/errors.ts";

export interface AetherConfig {
  baseUrl: string;
  headers?: Record<string, string>;
}

export function createAether<DB>(config: AetherConfig): DB {
  const carrier = new Carrier(config.baseUrl, config.headers);

  return createRecursiveProxy(async (path, args) => {
    // Split-Brain Routing: Plugins
    if (path[0] === "_plugins") {
      const namespace = path[1];
      const fnName = path[2];
      const payload = args[0];
      return carrier.request(`/_plugins/${namespace}/${fnName}`, {
        method: "POST",
        body: payload,
      });
    }

    if (path.length < 3) throw new Error(`Invalid path: ${path.join(".")}`);

    const method = path[path.length - 1];
    const table = path[path.length - 2];
    const schema = path[path.length - 3];

    switch (method) {
      case "findMany": {
        const options = args[0] as QueryOptions | undefined;
        const url = buildUrl(schema, table, options);
        return carrier.request(url, { method: "GET" });
      }
      case "findOne": {
        const options = args[0] as QueryOptions | undefined;
        // Force limit 1
        const url = buildUrl(schema, table, { ...options, limit: 1 });
        const result = await carrier.request<any[]>(url, { method: "GET" });

        // UNWRAP: Always return single object or null
        if (Array.isArray(result)) {
          return result.length > 0 ? result[0] : null;
        }
        return result;
      }
      case "create": {
        const data = args[0];
        // pREST strict path mapping
        const url = `/${schema}/${table}`;
        const result = await carrier.request(url, {
          method: "POST",
          body: data,
        });

        // NORMALIZE: Ensure we always return an Array T[]
        // If pREST returns a single object {id:1}, we wrap it in [{id:1}]
        if (result === null) return [];
        return Array.isArray(result) ? result : [result];
      }
      case "update": {
        const filter = args[0] as QueryFilter;
        const data = args[1];
        if (!filter || Object.keys(filter).length === 0) {
          throw new ValidationError("Missing filter");
        }

        const url = buildUrl(schema, table, { where: filter });
        const result = await carrier.request(url, {
          method: "PATCH",
          body: data,
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

        const url = buildUrl(schema, table, { where: filter });
        return carrier.request(url, { method: "DELETE" });
      }
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }) as DB;
}
