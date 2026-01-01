// examples/quickstart.ts
import { createAether } from "../src/runtime/mod.ts";

// 1. Configuration
// pREST URL structure: http://host:port/{DATABASE}
const API_URL = "http://localhost:3000/chimera";

async function main() {
  console.log(`🚀 Connecting to Aether Fabric at: ${API_URL}`);

  // 2. Initialize Client
  // In a real app, you would pass the generated <DB> generic here
  const db = createAether<any>({ baseUrl: API_URL });

  try {
    // 3. Simple Query: Get active users
    console.log("\n📋 Fetching active users...");
    const users = await db.public.users.findMany({
      where: { status: "active" },
      select: ["username", "age"],
      limit: 5,
    });

    console.table(users);

    console.log("\n✅ Quickstart complete!");
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

// Run with: deno run -A examples/quickstart.ts
if (import.meta.main) {
  main();
}
