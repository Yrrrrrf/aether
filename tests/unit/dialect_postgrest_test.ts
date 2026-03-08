import { assertEquals } from "@std/assert";
import { buildPostgrestUrl } from "../../src/runtime/dsl/dialect.ts";

Deno.test("Dialect PostgREST - Basic Select", () => {
  const url = buildPostgrestUrl("users");
  assertEquals(url, "/users");
});

Deno.test("Dialect PostgREST - Select Columns", () => {
  const url = buildPostgrestUrl("users", {
    select: ["id", "username"],
  });
  assertEquals(url, "/users?select=id,username");
});

Deno.test("Dialect PostgREST - Simple Equality", () => {
  const url = buildPostgrestUrl("users", {
    where: { status: "active" },
  });
  assertEquals(url, "/users?status=eq.active");
});

Deno.test("Dialect PostgREST - Comparison Operators", () => {
  const url = buildPostgrestUrl("users", {
    where: { age: { $gt: 21 } },
  });
  assertEquals(url, "/users?age=gt.21");
});

Deno.test("Dialect PostgREST - Not Equal", () => {
  const url = buildPostgrestUrl("users", {
    where: { status: { $neq: "banned" } },
  });
  assertEquals(url, "/users?status=neq.banned");
});

Deno.test("Dialect PostgREST - IN List", () => {
  const url = buildPostgrestUrl("users", {
    where: { id: { $in: [1, 2, 3] } },
  });
  assertEquals(url, "/users?id=in.(1,2,3)");
});

Deno.test("Dialect PostgREST - NULL Check", () => {
  const url = buildPostgrestUrl("users", {
    where: { deleted_at: { $is: null } },
  });
  assertEquals(url, "/users?deleted_at=is.null");
});

Deno.test("Dialect PostgREST - OR Group Format", () => {
  const url = buildPostgrestUrl("users", {
    where: { $or: [{ status: "active" }, { age: { $gt: 65 } }] },
  });
  assertEquals(url, "/users?or=(status.eq.active,age.gt.65)");
});

Deno.test("Dialect PostgREST - Nested AND inside OR", () => {
  const url = buildPostgrestUrl("users", {
    where: {
      $or: [
        { status: "active" },
        { $and: [{ age: { $gt: 20 } }, { age: { $lt: 30 } }] },
      ],
    },
  });
  assertEquals(url, "/users?or=(status.eq.active,and=(age.gt.20,age.lt.30))");
});

Deno.test("Dialect PostgREST - Pagination", () => {
  const url = buildPostgrestUrl("users", {
    limit: 10,
    offset: 20,
  });
  assertEquals(url, "/users?limit=10&offset=20");
});

Deno.test("Dialect PostgREST - Order Ascending", () => {
  const url = buildPostgrestUrl("users", {
    order: { name: "asc" },
  });
  assertEquals(url, "/users?order=name.asc");
});

Deno.test("Dialect PostgREST - Order Descending", () => {
  const url = buildPostgrestUrl("users", {
    order: { created_at: "desc" },
  });
  assertEquals(url, "/users?order=created_at.desc");
});

Deno.test("Dialect PostgREST - Order Multiple", () => {
  const url = buildPostgrestUrl("users", {
    order: { name: "asc", created_at: "desc" },
  });
  assertEquals(url, "/users?order=name.asc,created_at.desc");
});
