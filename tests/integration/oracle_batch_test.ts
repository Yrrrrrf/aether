import { assertEquals } from "@std/assert";
import { PostgresIntrospector } from "../../src/oracle/introspect/postgres.ts";
import { Client } from "postgres";

function safeGetEnv(key: string): string | undefined {
  try {
    return Deno.env.get(key);
  } catch {
    return undefined;
  }
}

const DB_CONN = safeGetEnv("DB_URL") ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

Deno.test({
  name: "🔮 Oracle: Batch Introspection Performance",
  ignore: safeGetEnv("TEST_PREST") !== "1" &&
    safeGetEnv("TEST_SUPABASE") !== "1",
  fn: async () => {
    const client = new Client(DB_CONN);
    await client.connect();

    try {
      // 1. Setup 100 tables
      await client.queryArray(`DROP SCHEMA IF EXISTS perf_test CASCADE;`);
      await client.queryArray(`CREATE SCHEMA perf_test;`);

      await client.queryArray(`
          CREATE TABLE perf_test.table_0 (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          );
      `);

      const statements = [];
      for (let i = 1; i < 100; i++) {
        statements.push(`
          CREATE TABLE perf_test.table_${i} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            ref_id INT REFERENCES perf_test.table_0(id)
          );
        `);
      }

      await client.queryArray(statements.join("\n"));

      // 2. Measure Introspection
      const introspector = new PostgresIntrospector(DB_CONN);
      await introspector.connect();

      const start = performance.now();
      const schema = await introspector.introspect();
      const duration = performance.now() - start;

      await introspector.close();

      // Ensure we got at least 100 tables
      const perfTables = schema.tables.filter((t) => t.schema === "perf_test");
      assertEquals(
        perfTables.length,
        100,
        "Should introspect exactly 100 tables from perf_test schema",
      );

      // Check performance
      console.log(`\nIntrospected 100 tables in ${Math.round(duration)}ms`);
      assertEquals(
        duration < 3000,
        true,
        `Introspection took too long: ${duration}ms (target < 3s)`,
      );
    } finally {
      // 3. Cleanup
      await client.queryArray(`DROP SCHEMA IF EXISTS perf_test CASCADE;`);
      await client.end();
    }
  },
});
