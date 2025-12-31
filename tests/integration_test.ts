import { assertEquals, assertExists } from "@std/assert";
import { createAether } from "../src/runtime/mod.ts";
import { PostgresIntrospector } from "../src/oracle/mod.ts";
import { generateTypeScript } from "../src/oracle/emitters/ts.ts";

// Config
const DB_CONN =
  "postgres://aether_user:aether_password@localhost:5432/aether_test";
const PGRST_URL = "http://localhost:3000";
const GENERATED_FILE = "./tests/generated_schema.d.ts";

/**
 * Helper: Wait for PostgREST to be up
 */
async function waitForService(url: string, retries = 5, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return; // 404 on root is fine for pREST sometimes
    } catch {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  console.warn("⚠️ Warning: Service might not be ready at", url);
}

Deno.test("🌌 Aether E2E Integration Suite", async (t) => {
  // 0. Wait for Docker services
  await waitForService(PGRST_URL);

  // 1. THE ORACLE: Introspect & Generate
  await t.step("🔮 Oracle: Introspection & Codegen", async () => {
    const introspector = new PostgresIntrospector(DB_CONN);
    try {
      await introspector.connect();
      const schema = await introspector.introspect();

      // Basic assertions on introspection result
      assertExists(
        schema.tables.find((t) => t.name === "users"),
        "Users table not found",
      );
      assertExists(
        schema.tables.find((t) => t.name === "posts"),
        "Posts table not found",
      );
      assertExists(
        schema.enums.find((e) => e.name === "user_status"),
        "Enum not found",
      );

      // Generate Types
      const tsCode = generateTypeScript(schema);
      await Deno.writeTextFile(GENERATED_FILE, tsCode);

      const fileContent = await Deno.readTextFile(GENERATED_FILE);
      assertEquals(fileContent.includes("export interface Users"), true);
      assertEquals(fileContent.includes("export interface DB"), true);

      console.log("   ✅ Generated types successfully.");
    } finally {
      await introspector.close();
    }
  });

  // 2. THE FABRIC: Runtime Operations
  // Note: In a real app, you would import the generated types.
  // For this test runner, we use generic typing but validate runtime behavior.

  const db = createAether<any>({ baseUrl: PGRST_URL });

  await t.step("🧵 Fabric: Read (findMany)", async () => {
    const users = await db.public.users.findMany({
      select: ["username", "status"],
    });

    assertExists(users);
    assertEquals(users.length >= 3, true); // Seed has 3 users
    assertEquals(users[0].username, "alice");
  });

  await t.step("🧵 Fabric: Create & BigInt Safety", async () => {
    // We create a post with a massive integer to test BigInt->String serialization
    const bigPrice = "9007199254740999"; // Larger than JS Number.MAX_SAFE_INTEGER

    await db.public.posts.create({
      author_id: 1,
      title: "Integration Test Post",
      content: "Testing BigInt",
      price: bigPrice,
    });

    const posts = await db.public.posts.findMany({
      where: { title: { $eq: "Integration Test Post" } },
    });

    assertEquals(posts.length, 1);
    assertEquals(posts[0].price, bigPrice); // Should return as string, exact match

    // Cleanup
    await db.public.posts.delete({ title: "Integration Test Post" });
  });

  await t.step("🧵 Fabric: Update with DSL", async () => {
    // Reset state just in case
    await db.public.users.update(
      { username: "bob" },
      { status: "active" },
    );

    // Update
    await db.public.users.update(
      { username: { $eq: "bob" } },
      { status: "inactive" },
    );

    const bob = await db.public.users.findOne({ where: { username: "bob" } });
    assertEquals(bob.status, "inactive");
  });

  await t.step("🧵 Fabric: Array & JSON Operators", async () => {
    // Test generated view or complex filter
    // active_users view test
    const active = await db.public.active_users.findMany({});
    // Alice is active, Charlie inactive, Bob inactive (from previous step)
    const alice = active.find((u: any) => u.username === "alice");
    assertExists(alice);
    assertEquals(active.some((u: any) => u.username === "charlie"), false);
  });
});
