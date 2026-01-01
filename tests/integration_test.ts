import { assertEquals, assertExists } from "@std/assert";
import { Client } from "postgres";
import { createAether } from "../src/runtime/mod.ts";
import { PostgresIntrospector } from "../src/oracle/mod.ts";
import { generateTypeScript } from "../src/oracle/emitters/ts.ts";

// --- CONFIGURATION ---
const DB_CONN =
  "postgres://chimera_admin:secure_password@localhost:5432/chimera";
const PGRST_URL = "http://localhost:3000";
const GENERATED_FILE = "./tests/generated_schema.d.ts";

async function waitForService(url: string, retries = 10, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);

      await res.body?.cancel();

      if (res.ok || res.status === 404 || res.status === 200) return;
    } catch {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  console.warn("⚠️ Warning: Service might not be ready at", url);
}

async function seedDatabase() {
  console.log("🌱 Seeding database...");
  const client = new Client(DB_CONN);
  await client.connect();

  try {
    await client.queryArray(`
      DROP VIEW IF EXISTS public.active_users;
      DROP TABLE IF EXISTS public.posts;
      DROP TABLE IF EXISTS public.users;
    `);

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

    await client.queryArray(`
      INSERT INTO public.users (username, status, age) VALUES
      ('alice', 'active', 25),
      ('bob', 'inactive', 30),
      ('charlie', 'active', 35);
    `);

    // Notify pREST to reload schema
    // Note: pREST (Go) often auto-reloads or doesn't need explicit notify like PostgREST (Haskell)
    // but sending a request to /databases usually refreshes internal cache if needed.

    console.log("✅ Database seeded.");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

Deno.test("🌌 Aether E2E Integration Suite", async (t) => {
  await seedDatabase();
  await waitForService(PGRST_URL);

  // 1. THE ORACLE
  await t.step("🔮 Oracle: Introspection & Codegen", async () => {
    const introspector = new PostgresIntrospector(DB_CONN);
    try {
      await introspector.connect();
      const schema = await introspector.introspect();
      assertExists(schema.tables.find((t) => t.name === "users"));
      const tsCode = generateTypeScript(schema);
      await Deno.writeTextFile(GENERATED_FILE, tsCode);
      console.log("   ✅ Generated types successfully.");
    } finally {
      await introspector.close();
    }
  });

  // 2. THE FABRIC
  // IMPORTANT: pREST URL structure is /{DATABASE}/{SCHEMA}/{TABLE}
  // createAether appends /{SCHEMA}/{TABLE}, so baseUrl must end with /{DATABASE}
  const db = createAether<any>({ baseUrl: `${PGRST_URL}/chimera` });

  await t.step("🧵 Fabric: Read (findMany)", async () => {
    const users = await db.public.users.findMany({
      select: ["username", "status"],
      order: { username: "asc" },
    });

    assertExists(users);
    assertEquals(users.length >= 3, true);
    assertEquals(users[0].username, "alice");
  });

  await t.step("🧵 Fabric: Create & BigInt Safety", async () => {
    const bigPrice = "9007199254740999";

    // Fetch user for relation
    const users = await db.public.users.findMany({ limit: 1 });
    const authorId = users[0].id;

    await db.public.posts.create({
      author_id: authorId,
      title: "Integration Test Post",
      content: "Testing BigInt",
      price: bigPrice,
    });

    const posts = await db.public.posts.findMany({
      where: { title: { $eq: "Integration Test Post" } },
    });

    assertEquals(posts.length, 1);
    assertEquals(posts[0].price, bigPrice);

    await db.public.posts.delete({ title: { $eq: "Integration Test Post" } });
  });

  await t.step("🧵 Fabric: Update with DSL", async () => {
    await db.public.users.update(
      { username: { $eq: "bob" } },
      { status: "inactive" },
    );

    // Verify update
    const bobInactive = await db.public.users.findOne({
      where: { username: { $eq: "bob" } },
    });
    assertEquals(bobInactive.status, "inactive");

    await db.public.users.update(
      { username: { $eq: "bob" } },
      { status: "active" },
    );

    const bobActive = await db.public.users.findOne({
      where: { username: { $eq: "bob" } },
    });
    assertEquals(bobActive.status, "active");
  });

  await t.step("🧵 Fabric: Array & JSON Operators", async () => {
    const active = await db.public.active_users.findMany({});
    const alice = active.find((u: any) => u.username === "alice");
    assertExists(alice);
  });
});
