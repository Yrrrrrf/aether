import { assertEquals, assertExists } from "@std/assert";
import { TEST_SCHEMA_FILE, withTestEnv } from "./fixtures.ts";

// 1. Test the Oracle Generation
withTestEnv("🔮 Oracle: Introspection & Codegen", async ({ generate }) => {
  await generate();

  const content = await Deno.readTextFile(TEST_SCHEMA_FILE);
  assertExists(content, "File should exist");
  assertEquals(
    content.includes("export interface Users"),
    true,
    "Should have Users interface",
  );
});

// 2. Test Reading Data
withTestEnv("🧵 Fabric: Read Users (findMany)", async ({ db }) => {
  const users = await db.public.users.findMany({
    select: ["username", "status"],
    order: { username: "asc" },
  });

  assertEquals(users.length, 3);
  assertEquals(users[0].username, "alice");
  assertEquals(users[2].username, "charlie");
});

// 3. Test BigInt Handling
withTestEnv("🧵 Fabric: Create & BigInt Safety", async ({ db }) => {
  const bigPrice = "9007199254740999";

  // Get author
  const alice = await db.public.users.findOne({ where: { username: "alice" } });

  // Create
  await db.public.posts.create({
    author_id: alice.id,
    title: "BigInt Test",
    price: bigPrice,
  });

  // Verify
  const post = await db.public.posts.findOne({
    where: { title: "BigInt Test" },
  });

  assertEquals(post.price, bigPrice, "BigInt should be preserved as string");
});

// 4. Test Updates
withTestEnv("🧵 Fabric: Update Logic", async ({ db }) => {
  // Update Bob to active
  await db.public.users.update(
    { username: { $eq: "bob" } },
    { status: "active" },
  );

  const bob = await db.public.users.findOne({ where: { username: "bob" } });
  assertEquals(bob.status, "active");
});
