import { Client } from "postgres";
import type {
  Column,
  DatabaseSchema,
  Enum,
  ForeignKey,
  Table,
} from "../ast/types.ts";

export class PostgresIntrospector {
  private client: Client;
  private mode?: string;

  constructor(connectionString: string, mode?: string) {
    this.client = new Client(connectionString);
    this.mode = mode;
  }

  async connect() {
    await this.client.connect();
  }

  async close() {
    await this.client.end();
  }

  async introspect(): Promise<DatabaseSchema> {
    const enums = await this.getEnums();
    const tables = await this.getTables();
    return { tables, enums };
  }

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
    }>(`
      SELECT 
        c.table_schema as schema,
        c.table_name as table,
        c.column_name as name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
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
