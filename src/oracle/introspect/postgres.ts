import { Client } from "postgres";
import type {
  Column,
  DatabaseSchema,
  Enum,
  ForeignKey,
  Table,
} from "../ast/types.ts";

/**
 * Connects to a PostgreSQL database and extracts its schema, tables, columns, and relations.
 */
export class PostgresIntrospector {
  private client: Client;
  private mode?: string;

  /**
   * Creates a new PostgresIntrospector instance.
   * @param connectionString - A postgres:// URL.
   * @param mode - Optional dialect mode (e.g. 'supabase' to filter internal schemas).
   */
  constructor(connectionString: string, mode?: string) {
    this.client = new Client(connectionString);
    this.mode = mode;
  }

  /**
   * Connects to the database using the provided connection string.
   */
  async connect() {
    await this.client.connect();
  }

  /**
   * Closes the active database connection.
   */
  async close() {
    await this.client.end();
  }

  /**
   * Extracts the full DatabaseSchema including tables, views, columns, foreign keys, and enums.
   * @returns The generated DatabaseSchema.
   */
  async introspect(): Promise<DatabaseSchema> {
    const enums = await this.getEnums();
    const tables = await this.getTables();
    const functions = await this.getFunctions();
    return { tables, enums, functions };
  }

  /**
   * Retrieves all PostgreSQL enumerations from pg_type.
   */
  private async getEnums(): Promise<Enum[]> {
    const result = await this.client.queryObject<{
      schema: string;
      name: string;
      value: string;
    }>(`
      SELECT 
        n.nspname as schema,
        t.typname as name,
        e.enumlabel as value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      ORDER BY n.nspname, t.typname, e.enumsortorder;
    `);

    const enums: Record<string, Enum> = {};
    for (const row of result.rows) {
      const key = `${row.schema}.${row.name}`;
      if (!enums[key]) {
        enums[key] = { schema: row.schema, name: row.name, values: [] };
      }
      enums[key].values.push(row.value);
    }

    return Object.values(enums);
  }

  /**
   * Parses standard PostgreSQL function signature arguments into a structured AST mapping array.
   * Maps default usages and parameter modalities (IN/OUT/VARIADIC).
   *
   * @param argsStr - The raw string of arguments from `pg_get_function_identity_arguments`.
   * @returns An array of parsed function parameters.
   */
  private parseParams(argsStr: string) {
    if (!argsStr) return [];
    const parameters: {
      name: string;
      type: string;
      mode: "IN" | "OUT" | "INOUT" | "VARIADIC";
      hasDefault: boolean;
    }[] = [];

    for (const arg of argsStr.split(", ")) {
      const parts = arg.trim().split(" ");
      if (parts.length === 0 || parts[0] === "") continue;

      let mode = "IN";
      const firstUpper = parts[0].toUpperCase();
      if (["IN", "OUT", "INOUT", "VARIADIC"].includes(firstUpper)) {
        mode = parts.shift()!.toUpperCase();
      }

      let hasDefault = false;
      const rejoined = parts.join(" ").toUpperCase();
      if (rejoined.includes(" DEFAULT ")) {
        hasDefault = true;
        const [nameAndType] = parts.join(" ").split(/ default /i);
        parts.splice(0, parts.length, ...nameAndType.trim().split(" "));
      }

      const paramType = parts.pop()!;
      const paramName = parts.length > 0 ? parts.join(" ") : "";

      parameters.push({
        name: paramName,
        type: paramType,
        mode: mode as "IN" | "OUT" | "INOUT" | "VARIADIC",
        hasDefault,
      });
    }

    return parameters;
  }

  /**
   * Introspects the active database for all callable functions and stored procedures.
   * Discards void triggers and internal aggregates, capturing only API-viable RPC footprints.
   *
   * @returns An array of metadata describing functions, parameters, and return shapes.
   */
  private async getFunctions() {
    let schemaExclusions = "'information_schema', 'pg_catalog'";
    if (this.mode === "supabase") {
      schemaExclusions +=
        ",'auth', 'storage', 'realtime', 'extensions', 'supabase_functions', '_realtime', 'pgsodium', 'vault'";
    }

    const query = `
      WITH func_info AS (
          SELECT
              p.oid, n.nspname AS schema, p.proname AS name,
              pg_get_function_identity_arguments(p.oid) AS arguments,
              COALESCE(pg_get_function_result(p.oid), 'void') AS return_type,
              p.prorettype,
              p.proretset AS returns_set, p.prokind AS kind, d.description
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          LEFT JOIN pg_description d ON p.oid = d.objoid
          WHERE n.nspname NOT IN (${schemaExclusions})
            AND p.prokind IN ('f', 'a', 'w')
            AND p.prorettype != 'void'::regtype
            AND NOT EXISTS (
              SELECT 1 FROM pg_depend dep JOIN pg_extension ext ON dep.refobjid = ext.oid
              WHERE dep.objid = p.oid
          )
      )
      SELECT * FROM func_info
      WHERE prorettype NOT IN (
          'anyelement'::regtype, 'anyarray'::regtype, 'anynonarray'::regtype,
          'anyenum'::regtype, 'anyrange'::regtype, 'record'::regtype,
          'trigger'::regtype, 'event_trigger'::regtype, 'internal'::regtype
      )
      ORDER BY name;
    `;

    const result = await this.client.queryObject<{
      schema: string;
      name: string;
      arguments: string;
      return_type: string;
      returns_set: boolean;
      description: string | null;
    }>(query);

    return result.rows.map((row) => {
      const isSetReturning = row.returns_set;
      const isScalar = !isSetReturning && !row.return_type.includes("TABLE");

      return {
        schema: row.schema,
        name: row.name,
        params: this.parseParams(row.arguments),
        returnType: row.return_type,
        isSetReturning,
        isScalar,
        description: row.description || undefined,
      };
    });
  }

  /**
   * Introspects tables, views, columns, and foreign keys from information_schema.
   */
  private async getTables(): Promise<Table[]> {
    let schemaExclusions = "'information_schema', 'pg_catalog'";
    if (this.mode === "supabase") {
      const supabaseInternal =
        ",'auth', 'storage', 'realtime', 'extensions', 'supabase_functions', '_realtime', 'pgsodium', 'vault'";
      schemaExclusions += supabaseInternal;
    }

    const tablesPromise = this.client.queryObject<{
      schema: string;
      name: string;
      kind: string;
    }>(`
      SELECT 
        table_schema as schema,
        table_name as name,
        table_type as kind
      FROM information_schema.tables
      WHERE table_schema NOT IN (${schemaExclusions})
    `);

    const columnsPromise = this.client.queryObject<{
      schema: string;
      table: string;
      name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
      comment: string | null;
      character_maximum_length: number | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
    }>(`
      SELECT 
        c.table_schema as schema,
        c.table_name as table,
        c.column_name as name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        pgd.description as comment
      FROM information_schema.columns c
      LEFT JOIN pg_class cl ON cl.relname = c.table_name 
                            AND cl.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = c.table_schema)
      LEFT JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attname = c.column_name AND a.attnum > 0
      LEFT JOIN pg_description pgd ON pgd.objoid = cl.oid AND pgd.objsubid = a.attnum
      WHERE c.table_schema NOT IN (${schemaExclusions})
      ORDER BY c.table_schema, c.table_name, c.ordinal_position
    `);

    const pksPromise = this.client.queryObject<{
      schema: string;
      table: string;
      column_name: string;
    }>(`
      SELECT 
        tc.table_schema as schema,
        tc.table_name as table,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema NOT IN (${schemaExclusions})
    `);

    const fksPromise = this.client.queryObject<{
      schema: string;
      table: string;
      column_name: string;
      target_schema: string;
      target_table: string;
      target_column: string;
    }>(`
      SELECT
        tc.table_schema as schema,
        tc.table_name as table,
        kcu.column_name,
        ccu.table_schema AS target_schema,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN (${schemaExclusions})
    `);

    const [tablesResult, columnsResult, pksResult, fksResult] = await Promise
      .all([
        tablesPromise,
        columnsPromise,
        pksPromise,
        fksPromise,
      ]);

    const colsMap = new Map<string, Column[]>();
    for (const row of columnsResult.rows) {
      const key = `${row.schema}.${row.table}`;
      if (!colsMap.has(key)) colsMap.set(key, []);
      colsMap.get(key)!.push({
        name: row.name,
        dataType: row.data_type,
        udtName: row.udt_name,
        isNullable: row.is_nullable === "YES",
        hasDefault: row.column_default !== null,
        comment: row.comment || undefined,
        maxLength: row.character_maximum_length ?? undefined,
        numericPrecision: row.numeric_precision ?? undefined,
        numericScale: row.numeric_scale ?? undefined,
      });
    }

    const pksMap = new Map<string, string[]>();
    for (const row of pksResult.rows) {
      const key = `${row.schema}.${row.table}`;
      if (!pksMap.has(key)) pksMap.set(key, []);
      pksMap.get(key)!.push(row.column_name);
    }

    const fksMap = new Map<string, ForeignKey[]>();
    for (const row of fksResult.rows) {
      const key = `${row.schema}.${row.table}`;
      if (!fksMap.has(key)) fksMap.set(key, []);
      fksMap.get(key)!.push({
        column: row.column_name,
        targetSchema: row.target_schema,
        targetTable: row.target_table,
        targetColumn: row.target_column,
      });
    }

    const tablesMap = new Map<string, typeof tablesResult.rows[0]>();
    for (const row of tablesResult.rows) {
      const key = `${row.schema}.${row.name}`;
      if (tablesMap.has(key)) {
        if (row.kind === "VIEW") {
          tablesMap.set(key, row);
        }
      } else {
        tablesMap.set(key, row);
      }
    }

    const tables: Table[] = [];
    for (const row of tablesMap.values()) {
      const key = `${row.schema}.${row.name}`;
      const isView = row.kind === "VIEW";
      const columns = colsMap.get(key) || [];
      const primaryKeys = pksMap.get(key) || [];
      const foreignKeys = fksMap.get(key) || [];

      tables.push({
        name: row.name,
        schema: row.schema,
        isView,
        columns,
        primaryKeys,
        foreignKeys,
      });
    }

    return tables;
  }
}
