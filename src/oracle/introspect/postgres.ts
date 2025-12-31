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

  constructor(connectionString: string) {
    this.client = new Client(connectionString);
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
    // 1. Get Tables and Views
    const tablesResult = await this.client.queryObject<{
      schema: string;
      name: string;
      kind: string;
    }>(`
      SELECT 
        table_schema as schema,
        table_name as name,
        table_type as kind
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    `);

    const tables: Table[] = [];

    for (const row of tablesResult.rows) {
      const isView = row.kind === "VIEW";
      const columns = await this.getColumns(row.schema, row.name);
      const primaryKeys = await this.getPrimaryKeys(row.schema, row.name);
      const foreignKeys = await this.getForeignKeys(row.schema, row.name);

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

  private async getColumns(schema: string, table: string): Promise<Column[]> {
    const result = await this.client.queryObject<{
      name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `
      SELECT 
        column_name as name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `,
      [schema, table],
    );

    return result.rows.map((row) => ({
      name: row.name,
      dataType: row.data_type,
      udtName: row.udt_name,
      isNullable: row.is_nullable === "YES",
      hasDefault: row.column_default !== null,
    }));
  }

  private async getPrimaryKeys(
    schema: string,
    table: string,
  ): Promise<string[]> {
    const result = await this.client.queryObject<{ column_name: string }>(
      `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
    `,
      [schema, table],
    );

    return result.rows.map((r) => r.column_name);
  }

  private async getForeignKeys(
    schema: string,
    table: string,
  ): Promise<ForeignKey[]> {
    const result = await this.client.queryObject<{
      column_name: string;
      target_schema: string;
      target_table: string;
      target_column: string;
    }>(
      `
      SELECT
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
        AND tc.table_schema = $1
        AND tc.table_name = $2
    `,
      [schema, table],
    );

    return result.rows.map((r) => ({
      column: r.column_name,
      targetSchema: r.target_schema,
      targetTable: r.target_table,
      targetColumn: r.target_column,
    }));
  }
}
