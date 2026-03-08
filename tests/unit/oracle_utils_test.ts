import { assertEquals } from "@std/assert";
import {
  toInterfaceName,
  toPascalCase,
  toSchemaName,
} from "../../src/oracle/utils.ts";

Deno.test("toPascalCase", () => {
  assertEquals(toPascalCase("users"), "Users");
  assertEquals(toPascalCase("active_users"), "ActiveUsers");
  assertEquals(toPascalCase("_internal_users"), "InternalUsers");
  assertEquals(toPascalCase("schema_table_name"), "SchemaTableName");
});

Deno.test("toInterfaceName", () => {
  assertEquals(toInterfaceName("public", "users"), "PublicUsers");
  assertEquals(
    toInterfaceName("private", "active_users"),
    "PrivateActiveUsers",
  );
});

Deno.test("toSchemaName", () => {
  assertEquals(toSchemaName("public", "users"), "PublicUsersSchema");
  assertEquals(
    toSchemaName("private", "active_users"),
    "PrivateActiveUsersSchema",
  );
});
