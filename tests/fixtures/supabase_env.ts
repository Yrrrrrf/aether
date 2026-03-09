import { Client } from "postgres";
import { createAether } from "../../src/runtime/mod.ts";
import { PostgresIntrospector } from "../../src/oracle/mod.ts";
import { generateTypeScript } from "../../src/oracle/emitters/ts.ts";

function safeGetEnv(key: string): string | undefined {
  try {
    return Deno.env.get(key);
  } catch {
    return undefined;
  }
}

const DB_CONN = safeGetEnv("DB_URL") ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SUPABASE_URL = safeGetEnv("SUPABASE_URL") || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = safeGetEnv("SUPABASE_ANON_KEY") ||
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

const SUPABASE_API = `${SUPABASE_URL}/rest/v1`;

export const TEST_SCHEMA_FILE = "./tests/gen_schemas.d.ts";

export interface TestContext {
  // deno-lint-ignore no-explicit-any
  db: any;
  seed: () => Promise<void>;
  generate: () => Promise<void>;
}

async function waitForService() {
  const url = `${SUPABASE_API}/`;
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

async function seedDatabase() {
  const client = new Client(DB_CONN);
  await client.connect();
  try {
    // 1. Clean
    await client.queryArray(`
      DROP VIEW IF EXISTS public.aether_active_users;
      DROP TABLE IF EXISTS public.aether_posts;
      DROP TABLE IF EXISTS public.aether_users;
    `);

    // 2. Schema
    await client.queryArray(`
      CREATE TABLE public.aether_users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        status TEXT NOT NULL,
        age INT
      );
      CREATE TABLE public.aether_posts (
        id SERIAL PRIMARY KEY,
        author_id INT REFERENCES public.aether_users(id),
        title TEXT,
        content TEXT,
        price BIGINT
      );
      CREATE VIEW public.aether_active_users AS
      SELECT * FROM public.aether_users WHERE status = 'active';
    `);

    // 3. Data
    await client.queryArray(`
      INSERT INTO public.aether_users (username, status, age) VALUES
      ('alice', 'active', 25),
      ('bob', 'inactive', 30),
      ('charlie', 'active', 35);
    `);
  } finally {
    await client.end();
  }
}

async function generateTypes() {
  const introspector = new PostgresIntrospector(DB_CONN, "supabase");
  try {
    await introspector.connect();
    const schema = await introspector.introspect();
    const tsCode = generateTypeScript(schema);
    await Deno.writeTextFile(TEST_SCHEMA_FILE, tsCode);
  } finally {
    await introspector.close();
  }
}

export function withSupabaseEnv(
  name: string,
  fn: (ctx: TestContext) => Promise<void>,
) {
  Deno.test({
    name,
    ignore: safeGetEnv("TEST_SUPABASE") !== "1",
    fn: async () => {
      // 1. Setup
      await waitForService();
      await seedDatabase();

      // 2. Create Client
      // deno-lint-ignore no-explicit-any
      const db = createAether<any>({
        baseUrl: SUPABASE_API,
        dialect: "supabase",
        apiKey: SUPABASE_ANON_KEY,
        auth: { getAccessToken: () => null }, // Just anon access
      });

      // 3. Run User Test
      await fn({
        db,
        seed: seedDatabase,
        generate: generateTypes,
      });
    },
  });
}
