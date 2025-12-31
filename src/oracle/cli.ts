import { parseArgs } from "@std/cli/parse-args";
import { PostgresIntrospector } from "./introspect/postgres.ts";
import { generateTypeScript } from "./emitters/ts.ts";
import { generateZod } from "./emitters/zod.ts";

async function main() {
  const flags = parseArgs(Deno.args, {
    string: ["url", "out", "zod-out"],
    default: { out: "./src/aether.d.ts" },
  });

  if (!flags.url) {
    console.error("Error: --url is required.");
    console.error(
      "Usage: deno task generate --url=<postgres_url> [--out=<path>] [--zod-out=<path>]",
    );
    Deno.exit(1);
  }

  console.log(`🔮 Oracle: Connecting to ${flags.url}...`);
  const oracle = new PostgresIntrospector(flags.url);

  try {
    await oracle.connect();
    console.log("👁️  Oracle: Introspecting database...");

    const schema = await oracle.introspect();
    console.log(
      `   Found ${schema.tables.length} tables and ${schema.enums.length} enums.`,
    );

    console.log("📜 Oracle: Generating types...");
    const tsCode = generateTypeScript(schema);

    console.log(`💾 Oracle: Writing to ${flags.out}...`);
    await Deno.writeTextFile(flags.out, tsCode);

    if (flags["zod-out"]) {
      console.log("🛡️  Oracle: Generating Zod schemas...");
      const zodCode = generateZod(schema);
      console.log(`💾 Oracle: Writing Zod schemas to ${flags["zod-out"]}...`);
      await Deno.writeTextFile(flags["zod-out"], zodCode);
    }

    console.log("✅ Oracle: Done.");
  } catch (error) {
    console.error("❌ Oracle Error:", error);
    Deno.exit(1);
  } finally {
    await oracle.close();
  }
}

if (import.meta.main) {
  main();
}
