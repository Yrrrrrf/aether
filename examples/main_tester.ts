// examples/main_tester.ts
import { createAether } from "../src/runtime/mod.ts";

// ==============================================================================
//  Aether: Main Example & Test Harness
// ==============================================================================
//  1. Config & Initialization
//  2. Create (BigInt Safety)
//  3. Advanced Reading (DSL: $gt, $in, $or)
//  4. Updates & Deletes
// ==============================================================================

// --- 1. Configuration ---
const HOST = Deno.env.get("DB_HOST") || "localhost";
const PORT = "3000";
const DB_NAME = "chimera";
const API_URL = `http://${HOST}:${PORT}/${DB_NAME}`;

// --- 2. Initialization ---
// We use <any> here, but after running the Oracle, you would use <DB>
const db = createAether<any>({ baseUrl: API_URL });

async function main() {
  console.log(`\n🌌 Aether Fabric Initialized on [${API_URL}]`);
  const uniqueId = crypto.randomUUID().split("-")[0];
  const testUsername = `tester_${uniqueId}`;

  try {
    // --- 3. CREATE (The "BigInt" Test) ---
    console.log(`\n[1] Creating User & Post (Testing BigInt Safety)...`);

    // Create User
    const [user] = await db.public.users.create({
      username: testUsername,
      status: "pending",
      age: 28,
    });
    console.log(`    > User created: ${user.username} (ID: ${user.id})`);

    // Create Post with Massive Integer
    // JS Numbers fail > 2^53. Aether handles this as a string automatically.
    const bigPrice = "9007199254740999";
    const [post] = await db.public.posts.create({
      author_id: user.id,
      title: "Aether Showcase",
      content: "Demonstrating type safety",
      price: bigPrice,
    });
    console.log(`    > Post created with Price: ${post.price}`);

    // --- 4. READ (The "DSL" Test) ---
    console.log(`\n[2] Performing Advanced Queries (DSL)...`);

    // Complex Filter: (Age > 20) AND (Status IN ['active', 'pending'])
    const results = await db.public.users.findMany({
      where: {
        age: { $gt: 20 },
        status: { $in: ["active", "pending"] },
        // Simple "LIKE" search
        username: { $like: "tester_%" },
      },
      order: { age: "desc" },
      limit: 5,
    });

    console.log(`    > Found ${results.length} users matching complex filter.`);

    // Verify BigInt read
    const fetchedPost = await db.public.posts.findOne({
      where: { id: post.id },
    });

    if (fetchedPost.price === bigPrice) {
      console.log(`    > ✅ BigInt Precision preserved: ${fetchedPost.price}`);
    } else {
      console.error(`    > ❌ BigInt Precision LOST: ${fetchedPost.price}`);
    }

    // --- 5. UPDATE ---
    console.log(`\n[3] Updating Records...`);

    await db.public.users.update(
      { username: testUsername }, // Filter
      { status: "active", age: 29 }, // Data
    );

    const updatedUser = await db.public.users.findOne({
      where: { username: testUsername },
    });
    console.log(`    > User status changed to: ${updatedUser.status}`);

    // --- 6. DELETE (Cleanup) ---
    console.log(`\n[4] Cleaning Up...`);

    // Cascade usually handles posts, but let's delete explicitly to show API
    await db.public.posts.delete({ author_id: user.id });
    await db.public.users.delete({ username: testUsername });

    console.log(`    > Cleanup complete.`);
  } catch (err) {
    console.error("\n❌ An error occurred during the showcase:");
    console.error(err);
  }
}

// Run with: deno run -A examples/main_tester.ts
if (import.meta.main) {
  main();
}
