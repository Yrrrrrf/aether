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
    // Split-Brain Routing
    // Case A: Plugin Call
    if (path[0] === "_plugins") {
      // path: ["_plugins", namespace, function]
      if (path.length < 3) {
        throw new Error(
          `Invalid Plugin path: ${
            path.join(".")
          }. Expected _plugins.namespace.function`,
        );
      }
      const namespace = path[1];
      const fnName = path[2];
      const payload = args[0];

      // Depending on backend config, might be /rpc/ or /_plugins/
      // Assuming standard pREST RPC or custom extension: /rpc/fnName usually,
      // but spec says /_plugins/{namespace}/{function}
      const url = `/_plugins/${namespace}/${fnName}`;
      return carrier.request(url, { method: "POST", body: payload });
    }

    // Case B: Table Operation
    // Expected path: [schema, table, method]
    if (path.length < 3) {
      throw new Error(
        `Invalid Aether path: ${path.join(".")}. Expected schema.table.method`,
      );
    }

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
        const url = buildUrl(schema, table, {
          ...options,
          limit: 1,
          single: true,
        });
        return carrier.request(url, {
          method: "GET",
          headers: { "Accept": "application/vnd.pgrst.object+json" },
        });
      }
      case "create": {
        const data = args[0];
        const url = `/${schema}/${table}`;
        return carrier.request(url, { method: "POST", body: data });
      }
      case "update": {
        const filter = args[0] as QueryFilter;
        const data = args[1];

        if (!filter || Object.keys(filter).length === 0) {
          throw new ValidationError(
            "Unsafe operation: Missing filter for update",
          );
        }

        // buildUrl handles 'where' -> query string
        // We reuse buildUrl just for the query params part?
        // buildUrl constructs /schema/table?params
        // We need exactly that.
        const url = buildUrl(schema, table, { where: filter });
        return carrier.request(url, { method: "PATCH", body: data });
      }
      case "delete": {
        const filter = args[0] as QueryFilter;

        if (!filter || Object.keys(filter).length === 0) {
          throw new ValidationError(
            "Unsafe operation: Missing filter for delete",
          );
        }

        const url = buildUrl(schema, table, { where: filter });
        return carrier.request(url, { method: "DELETE" });
      }
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }) as DB;
}
