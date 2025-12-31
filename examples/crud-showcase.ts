/**
 * examples/crud-showcase-profile.ts
 *
 * This script demonstrates basic CRUD operations using @jsr/prism-ts,
 * specifically targeting the 'account.profile' table from a prism-py API.
 *
 * Prerequisites:
 * 1. A prism-py API server (like the 'a_hub' example) must be running at http://localhost:8000.
 * 2. The API must include the 'account' schema and 'profile' table.
 * 3. (Optional but Recommended) Run type generation:
 *    `await prism.generateTypes("./src/your-types-dir");`
 *    and import the generated 'Profile' type for full type safety.
 */

import { BaseClient, CrudOperations, Prism, PrismError } from "../src/mod.ts";
// For detailed logging from the library itself (optional)
// import { log as prismClientLog, LogLevel } from "@jsr/prism-ts/tools/logging";

// --- Configuration ---
const API_BASE_URL = "http://localhost:8000";
const SCHEMA_NAME = "account";
const TABLE_NAME = "profile";

// If types are not generated, use a generic type matching Pydantic_profile:
type ProfileRecord = {
  id: string;
  username: string;
  email: string;
  full_name?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown; // Use unknown instead of any for better type safety
};

function generateUUID(): string {
  return crypto.randomUUID();
}

async function showcaseProfileCrudOperations() {
  console.log(
    `🚀 Starting prism-ts CRUD Showcase for ${SCHEMA_NAME}.${TABLE_NAME} 🚀`,
  );
  console.log(`Targeting API: ${API_BASE_URL}\n`);

  console.log("1. Initializing Prism client...");
  const baseClient = new BaseClient(API_BASE_URL);
  const prism = new Prism(baseClient);

  try {
    await prism.initialize();
    console.log("   ✅ Prism client initialized successfully.\n");
  } catch (error) {
    console.error("❌ Failed to initialize Prism client:", error);
    if (error instanceof PrismError && error.details) {
      console.error(
        "   API Error Details:",
        JSON.stringify(error.details, null, 2),
      );
    } else if (error instanceof Error) {
      console.error("   Error message:", error.message);
    }
    console.log(
      "   Ensure your prism-py API server is running and accessible.",
    );
    return;
  }

  console.log(
    `2. Getting operations for table "${SCHEMA_NAME}.${TABLE_NAME}"...`,
  );
  const profileOps: CrudOperations<ProfileRecord> = await prism
    .getTableOperations<ProfileRecord>(SCHEMA_NAME, TABLE_NAME);
  console.log("   ✅ Table operations obtained.\n");

  let createdProfileId: string | undefined;

  try {
    console.log("3. CREATE: Creating a new profile...");
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const newProfileData: ProfileRecord = {
      id: generateUUID(),
      username: `showcase_user_${uniqueSuffix}`,
      email: `showcase_${uniqueSuffix}@example.com`,
      full_name: "Showcase User",
      status: "active",
    };
    console.log(
      "   Sending data:",
      JSON.stringify(newProfileData, null, 2),
    );

    const createdProfile = await profileOps.create(newProfileData);
    createdProfileId = createdProfile.id;
    console.log("   ✅ Profile created successfully!");
    console.log(
      "   Created Profile:",
      JSON.stringify(createdProfile, null, 2),
      "\n",
    );
    assertProfileId(createdProfileId, "CREATE");

    console.log(
      `4. READ (FindOne): Fetching profile with ID "${createdProfileId}"...`,
    );
    const fetchedProfile = await profileOps.findOne(createdProfileId!);
    console.log("   ✅ Profile fetched successfully!");
    console.log(
      "   Fetched Profile:",
      JSON.stringify(fetchedProfile, null, 2),
      "\n",
    );
    assertProfileData(fetchedProfile, createdProfile, "Fetch after create");

    console.log(
      "5. READ (FindMany): Fetching active profiles, ordered by username...",
    );
    const activeProfiles = await profileOps.findMany({
      where: {
        status: "active",
        username: `showcase_user_${uniqueSuffix}`,
      },
      limit: 5,
      orderBy: "username", // Corrected: Use string for orderBy
      orderDir: "asc", // Corrected: Use separate orderDir
    });
    console.log(
      `   ✅ Found ${activeProfiles.length} profile(s) matching filter:`,
    );
    activeProfiles.forEach((profile, index) =>
      console.log(
        `      ${
          index + 1
        }. ${profile.username} (ID: ${profile.id}, Status: ${profile.status})`,
      )
    );
    console.log("");
    if (activeProfiles.length > 0) {
      assert(
        activeProfiles.some((p) => p.id === createdProfileId),
        "Created profile not found in findMany result",
      );
    }

    console.log(
      `6. UPDATE: Updating profile with ID "${createdProfileId}"...`,
    );
    const updatePayload: Partial<ProfileRecord> = {
      full_name: "Showcase User (Updated)",
      status: "inactive",
    };
    const fullUpdatePayload: ProfileRecord = {
      ...fetchedProfile,
      ...updatePayload,
    };
    console.log(
      "   Sending update payload:",
      JSON.stringify(fullUpdatePayload, null, 2),
    );

    const updatedProfile = await profileOps.update(
      createdProfileId!,
      fullUpdatePayload,
    );
    console.log("   ✅ Profile updated successfully!");
    console.log(
      "   Updated Profile:",
      JSON.stringify(updatedProfile, null, 2),
      "\n",
    );
    assertEquals(updatedProfile.full_name, "Showcase User (Updated)");
    assertEquals(updatedProfile.status, "inactive");
    assert(
      updatedProfile.updated_at !== fetchedProfile.updated_at,
      "updated_at should have changed",
    );

    // --- COUNT Operations (Commented out until /count endpoint is available) ---
    // console.log("7. READ (Count): Counting all profiles...");
    // const totalCount = await profileOps.count();
    // console.log(`   ✅ Total profiles in table: ${totalCount}\n`);

    // console.log("   Counting 'inactive' profiles...");
    // const inactiveCount = await profileOps.count({ where: { status: "inactive" } });
    // console.log(`   ✅ Total 'inactive' profiles: ${inactiveCount}\n`);
    // assert(inactiveCount > 0, "Expected at least one inactive profile after update");
  } catch (error) {
    console.error("❌ An error occurred during CRUD operations:", error);
    if (error instanceof PrismError && error.details) { // Corrected: Check for PrismError and details
      console.error(
        "   API Error Details:",
        JSON.stringify(error.details, null, 2),
      );
    } else if (error instanceof Error) {
      console.error("   Error message:", error.message);
    }
  } finally {
    if (createdProfileId) {
      console.log(
        `8. DELETE: Deleting profile with ID "${createdProfileId}" (cleanup)...`,
      );
      try {
        await profileOps.delete(createdProfileId);
        console.log("   ✅ Profile deleted successfully.\n");
        try {
          await profileOps.findOne(createdProfileId);
          console.error(
            "   ❌ ERROR: Profile still found after delete!",
          );
        } catch (findError) {
          if (
            findError instanceof Error &&
            findError.message.includes("No record found")
          ) {
            console.log(
              "      ✅ Deletion verified (findOne threw 'No record found').",
            );
          } else {
            console.error(
              "      ⚠️  Could not verify deletion via findOne:",
              findError,
            );
          }
        }
      } catch (deleteError) {
        console.error(
          `   ❌ Failed to delete profile with ID "${createdProfileId}":`,
          deleteError,
        );
      }
    }
  }
  console.log("🎉 Profile CRUD Showcase Completed 🎉");
}

// Simple assertion helpers for the showcase
function assert(condition: boolean, message: string) {
  if (!condition) console.warn(`   ⚠️ Assertion failed: ${message}`);
}
function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { // Simple JSON comparison
    console.warn(
      `   ⚠️ Assertion failed (assertEquals) - ${message || ""}: Expected "${
        JSON.stringify(expected)
      }", got "${JSON.stringify(actual)}"`,
    );
  }
}
function assertProfileId(
  id: string | number | undefined,
  operation: string,
): asserts id is string {
  if (typeof id !== "string" || !id) {
    throw new Error(
      `Profile ID is invalid after ${operation} operation. Got: ${id}`,
    );
  }
}
function assertProfileData(
  actual: ProfileRecord,
  expected: ProfileRecord,
  context: string,
) {
  assertEquals(actual.id, expected.id, `${context}: ID mismatch`);
  assertEquals(
    actual.username,
    expected.username,
    `${context}: Username mismatch`,
  );
  assertEquals(actual.email, expected.email, `${context}: Email mismatch`);
}

showcaseProfileCrudOperations().catch((err) => {
  console.error("Unhandled error in showcase:", err);
});
