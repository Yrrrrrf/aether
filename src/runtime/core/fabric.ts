import { buildTransport } from "../transport/client.ts";
import { createRecursiveProxy } from "./proxy.ts";
import { buildPostgrestUrl, buildUrl } from "../dsl/dialect.ts";
import type { QueryFilter, QueryOptions } from "../dsl/types.ts";
import { ValidationError } from "../transport/errors.ts";
import type { AuthProvider } from "../auth/types.ts";
import { tokenAdapter } from "../auth/adapters.ts";
import type { ValidationStrategy } from "../validation/types.ts";

export interface AetherConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  dialect?: "prest" | "postgrest" | "supabase";
  apiKey?: string;

  /** @deprecated use `auth` instead */
  getAccessToken?: () => string | null | Promise<string | null>;

  auth?: AuthProvider;

  /** @deprecated use `validators` instead */
  validate?: ValidationStrategy;

  // deno-lint-ignore no-explicit-any
  validators?: Record<string, ValidationStrategy<any>>;
  schema?: string;
}

export function isPostgrestDialect(config: AetherConfig): boolean {
  return config.dialect === "postgrest" || config.dialect === "supabase" ||
    !!config.apiKey;
}

export function resolveWriteHeaders(
  config: AetherConfig,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (isPostgrestDialect(config)) {
    headers["Prefer"] = "return=representation";
    if (config.schema && config.schema !== "public") {
      headers["Content-Profile"] = config.schema;
    }
  }
  return headers;
}

export function createAether<DB>(rawConfig: AetherConfig): DB {
  const config = { ...rawConfig };
  // v1 compatibility shim
  if (config.getAccessToken && !config.auth) {
    config.auth = tokenAdapter(config.getAccessToken);
  }

  const isPostgrest = isPostgrestDialect(config);
  const request = buildTransport(config);
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
          return request(`/rpc/${fnName}`, {
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
        return request(`/_plugins/${namespace}/${fnName}`, {
          method: "POST",
          body: payload,
        });
      }
    }

    if (path.length < 3) throw new Error(`Invalid path: ${path.join(".")}`);

    const method = path[path.length - 1];
    const table = path[path.length - 2];
    const schema = path[path.length - 3];

    // deno-lint-ignore no-explicit-any
    let result: any;

    switch (method) {
      case "findMany": {
        const options = args[0] as QueryOptions | undefined;
        const url = isPostgrest
          ? buildPostgrestUrl(table, options)
          : buildUrl(schema, table, options);
        result = await request(url, { method: "GET" });
        break;
      }
      case "findOne": {
        const options = args[0] as QueryOptions | undefined;
        // Force limit 1
        const url = isPostgrest
          ? buildPostgrestUrl(table, { ...options, limit: 1 })
          : buildUrl(schema, table, { ...options, limit: 1 });
        const list = await request<unknown[]>(url, { method: "GET" });

        // UNWRAP: Always return single object or null
        if (Array.isArray(list)) {
          result = list.length > 0 ? list[0] : null;
        } else {
          result = list;
        }
        break;
      }
      case "create": {
        const data = args[0];
        const url = isPostgrest ? `/${table}` : `/${schema}/${table}`;
        const createResult = await request(url, {
          method: "POST",
          body: data,
          headers: writeHeaders,
        });

        // NORMALIZE: Ensure we always return an Array T[]
        if (createResult === null) {
          result = [];
        } else {
          result = Array.isArray(createResult) ? createResult : [createResult];
        }
        break;
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

        const updateResult = await request(url, {
          method: "PATCH",
          body: data,
          headers: writeHeaders,
        });

        // NORMALIZE: Ensure Array T[]
        if (updateResult === null) {
          result = [];
        } else {
          result = Array.isArray(updateResult) ? updateResult : [updateResult];
        }
        break;
      }
      case "delete": {
        const filter = args[0] as QueryFilter;
        if (!filter || Object.keys(filter).length === 0) {
          throw new ValidationError("Missing filter");
        }

        const url = isPostgrest
          ? buildPostgrestUrl(table, { where: filter })
          : buildUrl(schema, table, { where: filter });

        result = await request(url, { method: "DELETE" });
        break;
      }
      default:
        throw new Error(`Unknown method: ${method}`);
    }

    // Validation Application
    // deno-lint-ignore no-explicit-any
    const applyValidation = (data: any, strategy?: ValidationStrategy) => {
      if (!strategy || data === null) return data;
      if (Array.isArray(data)) return data.map((item) => strategy.parse(item));
      return strategy.parse(data);
    };

    // deno-lint-ignore no-explicit-any
    const options = args[0] as any;
    const validator = options?.validate ??
      (config.validators ? config.validators[table] : config.validate);
    result = applyValidation(result, validator);

    return result;
  }) as DB;
}
