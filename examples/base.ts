// 00-client-test.ts
import { BaseClient, displayInfo, Prism } from "../src/mod.ts";
// import { BaseClient, displayInfo, Prism } from "@yrrrrrf/prism-ts";
import { log, LogLevel } from "../src/tools/logging.ts";
// import { log, LogLevel } from "@yrrrrrf/prism-ts/tools/logging";

// Set log level to see more details during testing
log.setLevel(LogLevel.DEBUG);

/**
 * Main test function to explore Prism API capabilities
 */
async function main() {
  console.clear();

  // Display library info
  displayInfo();
  console.log("\n---------------------------------------\n");

  // Connect to the Prism API (using the Python config settings)
  const apiUrl = "http://localhost:8000";
  console.log(`Connecting to API at: ${apiUrl}`);

  // Create client instance
  const client = new BaseClient(apiUrl);
  const prism = new Prism(client);

  try {
    // Initialize and load metadata
    console.log("Initializing PrismTs client...");
    await prism.initialize();
    console.log("Initialization complete!\n");

    // Testing schema visualization - display overview
    console.log("Displaying schema statistics:");
    await prism.displaySchemaStats();

    // if (typeof prism.displaySchema === "function") {
    // 	console.log("\nDetailed schema display:");
    // 	await prism.displaySchema();
    // }

    // Health status checks
    try {
      console.log("\nChecking API health...");
      const health = await prism.getHealth();
      console.log("API Health Status:", health);

      console.log("\nPinging API...");
      const ping = await prism.ping();
      console.log("Ping response:", ping);

      console.log("\nGetting cache status...");
      const cacheStatus = await prism.getCacheStatus();
      console.log("Cache Status:", cacheStatus);
    } catch (error) {
      console.warn("Health endpoints not available:", error);
    }

    // Testing schema access
    console.log("\nAvailable schemas:");
    const schemas = await prism.getSchemas();
    schemas.forEach((schema) => {
      console.log(
        `- ${schema.name} (${Object.keys(schema.tables || {}).length} tables)`,
      );
    });

    // Test table operations on a sample table if available
    if (schemas.length > 0) {
      const schema = schemas[0];
      const tables = Object.keys(schema.tables || {});

      if (tables.length > 0) {
        const tableName = tables[0];
        console.log(
          `\nTesting table operations for ${schema.name}.${tableName}...`,
        );

        const tableOps = await prism.getTableOperations(
          schema.name,
          tableName,
        );

        try {
          // Get first 5 records
          console.log(`Fetching records from ${tableName}...`);
          const records = await tableOps.findAll({ limit: 5 });
          console.log(`Found ${records.length} records:`);
          console.log(records);
        } catch (error) {
          console.error(`Error fetching records: ${error}`);
        }
      } else {
        console.log(
          `\nNo tables found in schema ${schema.name} to test operations`,
        );
      }
    }

    // Type generation test (commented out to avoid file creation during testing)
    // console.log("\nGenerating TypeScript types...");
    // await prism.generateTypes("./src/gen");
    // console.log("Types generated successfully!");
  } catch (error) {
    console.error("Error during testing:", error);
  }
}

// Run the test script
main()
  .then(() => console.log("\nTest completed successfully!"))
  .catch((error) => console.error("Test failed:", error))
  .finally(() => console.log("\nTest script execution completed."));
