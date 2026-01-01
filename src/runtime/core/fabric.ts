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
    if (path[0] === "_plugins") {
      // ... plugin logic ...
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
        // Force limit 1 to verify uniqueness optimization on server if supported
        const url = buildUrl(schema, table, { ...options, limit: 1 });

        const result = await carrier.request<any[]>(url, { method: "GET" });

        // UNWRAP LOGIC
        if (Array.isArray(result)) {
          return result.length > 0 ? result[0] : null;
        }
        return result;
      }
      case "create": {
        const data = args[0];
        // pREST requires database/schema/table in URL generally, but here we assume strict mapping
        // based on the client BaseURL.
        const url = `/${schema}/${table}`;
        return carrier.request(url, { method: "POST", body: data });
      }
      case "update": {
        const filter = args[0] as QueryFilter;
        const data = args[1];
        if (!filter || Object.keys(filter).length === 0) {
          throw new ValidationError("Missing filter");
        }

        const url = buildUrl(schema, table, { where: filter });
        return carrier.request(url, { method: "PATCH", body: data });
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
