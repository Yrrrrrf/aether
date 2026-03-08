import { assertEquals } from "@std/assert";
import { generateTypeScript } from "../../src/oracle/emitters/ts.ts";
import { generateZod } from "../../src/oracle/emitters/zod.ts";
import type { DatabaseSchema } from "../../src/oracle/ast/types.ts";

Deno.test("Oracle Emitters - Naming and Deduplication Snapshot", () => {
  const mockSchema: DatabaseSchema = {
    enums: [
      {
        schema: "public",
        name: "user_status",
        values: ["active", "suspended"],
      },
    ],
    tables: [
      {
        schema: "public",
        name: "users",
        isView: false,
        columns: [
          {
            name: "id",
            dataType: "uuid",
            udtName: "uuid",
            isNullable: false,
            hasDefault: true,
          },
          {
            name: "status",
            dataType: "user_status",
            udtName: "user_status",
            isNullable: false,
            hasDefault: true,
          },
          {
            name: "meta",
            dataType: "jsonb",
            udtName: "jsonb",
            isNullable: true,
            hasDefault: false,
          },
        ],
        primaryKeys: ["id"],
        foreignKeys: [],
      },
      {
        schema: "private",
        name: "users",
        isView: true,
        columns: [
          {
            name: "id",
            dataType: "uuid",
            udtName: "uuid",
            isNullable: false,
            hasDefault: false,
          },
        ],
        primaryKeys: [],
        foreignKeys: [],
      },
      {
        schema: "public",
        name: "report_items",
        isView: true,
        columns: [
          {
            name: "id",
            dataType: "integer",
            udtName: "int4",
            isNullable: false,
            hasDefault: true,
          },
          {
            name: "user_id",
            dataType: "uuid",
            udtName: "uuid",
            isNullable: false,
            hasDefault: false,
          },
        ],
        primaryKeys: ["id"],
        foreignKeys: [{
          column: "user_id",
          targetSchema: "private",
          targetTable: "users",
          targetColumn: "id",
        }],
      },
    ],
  };

  const tsCode = generateTypeScript(mockSchema, "../../src/runtime/mod.ts");
  const zodCode = generateZod(mockSchema, "../../src/runtime/mod.ts");

  // Type emissions check
  assertEquals(
    tsCode.includes("export interface PublicUsers {"),
    true,
    "Missing PublicUsers interface",
  );
  assertEquals(
    tsCode.includes("export interface PrivateUsers {"),
    true,
    "Missing PrivateUsers interface",
  );
  assertEquals(
    tsCode.includes("export interface PublicReportItems {"),
    true,
    "Missing PublicReportItems interface",
  );

  // DB Record Check
  assertEquals(
    tsCode.includes(
      "users: TableOperations<PublicUsers, PublicUsersRelations>;",
    ),
    true,
    "Missing public users TableOps",
  );
  assertEquals(
    tsCode.includes(
      "users: ViewOperations<PrivateUsers, PrivateUsersRelations>;",
    ),
    true,
    "Missing private users ViewOps",
  );

  // Relations check
  assertEquals(
    tsCode.includes("users?: PrivateUsers;"),
    true,
    "Missing PrivateUsers foreign key representation",
  );

  // Zod Checks
  assertEquals(
    zodCode.includes("export const PublicUsersSchema = z.object({"),
    true,
    "Missing PublicUsersSchema object",
  );
  assertEquals(
    zodCode.includes("export const PrivateUsersSchema = z.object({"),
    true,
    "Missing PrivateUsersSchema object",
  );
  assertEquals(
    zodCode.includes("users: PublicUsersSchema as ValidationStrategy,"),
    true,
    "Missing public table validators mapping",
  );
  assertEquals(
    zodCode.includes("users: PrivateUsersSchema as ValidationStrategy,"),
    true,
    "Missing private view validators mapping",
  );
});
