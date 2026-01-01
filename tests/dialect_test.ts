import { assertEquals } from "@std/assert";
import { buildUrl } from "../src/runtime/dsl/dialect.ts";

Deno.test("Dialect - Basic Select", () => {
  const url = buildUrl("public", "users", {
    select: ["id", "username"],
    limit: 10,
  });
  // Updated expectation: _page=1 is now auto-appended
  assertEquals(url, "/public/users?_select=id,username&_page_size=10&_page=1");
});

Deno.test("Dialect - Simple Filter", () => {
  const url = buildUrl("public", "users", {
    where: {
      age: { $gt: 18 },
      status: "active",
    },
  });
  assertEquals(url.includes("age=$gt.18"), true);
  assertEquals(url.includes("status=$eq.active"), true);
});

Deno.test("Dialect - Nested Filter (Dot Notation)", () => {
  const url = buildUrl("public", "posts", {
    where: {
      author: {
        name: { $eq: "John" },
      },
    },
  });
  assertEquals(url.includes("author.name=$eq.John"), true);
});

Deno.test("Dialect - Array Operators ($in)", () => {
  const url = buildUrl("public", "users", {
    where: {
      id: { $in: [1, 2, 3] },
    },
  });
  assertEquals(url.includes("id=$in.(1,2,3)"), true);
});

Deno.test("Dialect - Logical Operators ($or)", () => {
  const url = buildUrl("public", "users", {
    where: {
      $or: [
        { status: "active" },
        { age: { $gt: 65 } },
      ],
    },
  });
  assertEquals(url.includes("or=(status=$eq.active,age=$gt.65)"), true);
});
