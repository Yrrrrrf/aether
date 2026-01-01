import { Client } from "postgres";
import { createAether } from "../src/runtime/mod.ts";
import { PostgresIntrospector } from "../src/oracle/mod.ts";
import { generateTypeScript } from "../src/oracle/emitters/ts.ts";

// Config
const DB_CONN =
  "postgres://chimera_admin:secure_password@localhost:5432/chimera";
const PGRST_BASE = "http://localhost:3000";
const PGRST_API = `${PGRST_BASE}/chimera`; // The actual API root for Aether

export const TEST_SCHEMA_FILE = "./tests/generated_schema.d.ts";

/**
 * SetupContext: Passed to every test so they have what they need
 */
export interface TestContext {
  db: any; // In real usage, this would be <DB> generic
  seed: () => Promise<void>;
  generate: () => Promise<void>;
}

/**
 * Helper to wait for pREST to be ready
 */
async function waitForService() {
  const url = `${PGRST_BASE}/databases`; // A known pREST endpoint
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(url);
      await res.body?.cancel();
      if (res.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Service at ${url} is not ready.`);
}

/**
 * Resets the database state
 */
async function seedDatabase() {
  const client = new Client(DB_CONN);
  await client.connect();
  try {
    // 1. Clean
    await client.queryArray(`
      DROP VIEW IF EXISTS public.active_users;
      DROP TABLE IF EXISTS public.posts;
      DROP TABLE IF EXISTS public.users;
    `);

    // 2. Schema
    await client.queryArray(`
      CREATE TABLE public.users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        status TEXT NOT NULL,
        age INT
      );
      CREATE TABLE public.posts (
        id SERIAL PRIMARY KEY,
        author_id INT REFERENCES public.users(id),
        title TEXT,
        content TEXT,
        price BIGINT
      );
      CREATE VIEW public.active_users AS
      SELECT * FROM public.users WHERE status = 'active';
    `);

    // 3. Data
    await client.queryArray(`
      INSERT INTO public.users (username, status, age) VALUES
      ('alice', 'active', 25),
      ('bob', 'inactive', 30),
      ('charlie', 'active', 35);
    `);
  } finally {
    await client.end();
  }
}

/**
 * Runs the Oracle to generate types (Test step)
 */
async function generateTypes() {
  const introspector = new PostgresIntrospector(DB_CONN);
  try {
    await introspector.connect();
    const schema = await introspector.introspect();
    const tsCode = generateTypeScript(schema);
    await Deno.writeTextFile(TEST_SCHEMA_FILE, tsCode);
  } finally {
    await introspector.close();
  }
}

/**
 * The Main Test Wrapper
 * Handles setup/teardown automatically around your test function
 */
export async function withTestEnv(
  name: string,
  fn: (ctx: TestContext) => Promise<void>,
) {
  Deno.test(name, async () => {
    // 1. Setup
    await waitForService();
    await seedDatabase();

    // 2. Create Client
    const db = createAether<any>({ baseUrl: PGRST_API });

    // 3. Run User Test
    await fn({
      db,
      seed: seedDatabase,
      generate: generateTypes,
    });
  });
}
