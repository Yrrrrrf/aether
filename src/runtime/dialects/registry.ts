import { buildPostgrestUrl } from "./postgrest.ts";
import { buildUrl as buildPrestUrl } from "../dsl/dialect.ts";
import type { QueryOptions } from "../dsl/types.ts";

export type DialectType = "prest" | "postgrest" | "supabase";

export interface DialectConfig {
  name: DialectType;
  isPostgrest: boolean;
  buildUrl: (schema: string, table: string, query?: QueryOptions) => string;
}

export const DIALECTS: Record<DialectType, DialectConfig> = {
  prest: {
    name: "prest",
    isPostgrest: false,
    buildUrl: buildPrestUrl,
  },
  postgrest: {
    name: "postgrest",
    isPostgrest: true,
    buildUrl: (_schema, table, query) => buildPostgrestUrl(table, query),
  },
  supabase: {
    name: "supabase",
    isPostgrest: true,
    buildUrl: (_schema, table, query) => buildPostgrestUrl(table, query),
  },
};
