import { assertEquals, assertExists } from "@std/assert";
import { TEST_SCHEMA_FILE, withSupabaseEnv } from "../fixtures/supabase_env.ts";

// 1. Test the Supabase Oracle Generation
withSupabaseEnv(
  "🔮 Supabase Oracle: Introspection & Codegen",
  async ({ generate }) => {
    await generate();

    const content = await Deno.readTextFile(TEST_SCHEMA_FILE);
    assertExists(content, "File should exist");
    assertEquals(
      content.includes("export interface PublicAetherUsers"),
      true,
      "Should have PublicAetherUsers interface generated from DB",
    );
    // Ensure we filtered out the Supabase internal schema Auth
    assertEquals(
      content.includes("export interface AuthUsers"),
      false,
      "Should NOT contain internal Supabase auth tables",
    );
  },
);

// 2. Test Reading Data
withSupabaseEnv(
  "🧵 Supabase Fabric: Read Users (findMany & order)",
  async ({ db }) => {
    const users = await db.public.aether_users.findMany({
      select: ["username", "status"],
      order: { username: "asc" },
    });

    assertEquals(users.length, 3);
    assertEquals(users[0].username, "alice");
    assertEquals(users[2].username, "charlie");
  },
);

// 3. Test Count & Pagination & Operators
withSupabaseEnv(
  "🧵 Supabase Fabric: Filter and exact count",
  async ({ db }) => {
    const users = await db.public.aether_users.findMany({
      where: { status: "active", age: { $gte: 20 } },
      count: "exact",
      limit: 1,
    });

    assertEquals(users.data.length, 1);
    assertEquals(users.count, 2);
    assertEquals(typeof users.data[0].username, "string"); // Cannot guarantee alice without explicit order
  },
);

// 4. Test BigInt Handling
withSupabaseEnv(
  "🧵 Supabase Fabric: Create & BigInt Safety",
  async ({ db }) => {
    const bigPrice = "9007199254740999";

    // Get author
    const alice = await db.public.aether_users.findOne({
      where: { username: "alice" },
    });

    // Create
    const result = await db.public.aether_posts.create({
      author_id: alice.id,
      title: "BigInt Supabase Test",
      price: bigPrice,
    });

    assertEquals(
      result.length,
      1,
      "Should return array with representation Prefer header",
    );

    // Verify
    const post = await db.public.aether_posts.findOne({
      where: { title: "BigInt Supabase Test" },
    });

    assertEquals(post.price, bigPrice, "BigInt should be preserved as string");
  },
);

// 5. Test Updates
withSupabaseEnv(
  "🧵 Supabase Fabric: Update Logic with Return Representation",
  async ({ db }) => {
    // Update Bob to active
    const result = await db.public.aether_users.update(
      { username: { $eq: "bob" } },
      { status: "active" },
    );

    assertEquals(
      result.length,
      1,
      "Update returns updated rows from PostgREST",
    );
    assertEquals(result[0].status, "active", "Returns correct data");

    const bob = await db.public.aether_users.findOne({
      where: { username: "bob" },
    });
    assertEquals(bob.status, "active");
  },
);
