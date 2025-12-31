import { assertEquals } from "@std/assert";
import { buildUrl } from "../src/runtime/dsl/dialect.ts";

Deno.test("Dialect - Basic Select", () => {
  const url = buildUrl("public", "users", {
    select: ["id", "username"],
    limit: 10,
  });
  assertEquals(url, "/public/users?select=id,username&limit=10");
});

Deno.test("Dialect - Simple Filter", () => {
  const url = buildUrl("public", "users", {
    where: {
      age: { $gt: 18 },
      status: "active",
    },
  });
  // Note: Object key order is generally preserved in JS, but technically not guaranteed.
  // In tests, we might want to split parameters to check presence.
  // For now, simple assertion.
  assertEquals(url.includes("age=gt.18"), true);
  assertEquals(url.includes("status=eq.active"), true);
});

Deno.test("Dialect - Nested Filter (Dot Notation)", () => {
  const url = buildUrl("public", "posts", {
    where: {
      author: {
        name: { $eq: "John" },
      },
    },
  });
  assertEquals(url.includes("author.name=eq.John"), true);
});

Deno.test("Dialect - Array Operators ($in)", () => {
  const url = buildUrl("public", "users", {
    where: {
      id: { $in: [1, 2, 3] },
    },
  });
  assertEquals(url.includes("id=in.(1,2,3)"), true);
});

Deno.test("Dialect - Array Operators ($cs)", () => {
  const url = buildUrl("public", "items", {
    where: {
      tags: { $cs: ["sale", "new"] },
    },
  });
  // Expects {sale,new} for array literal
  assertEquals(url.includes('tags=cs.{"sale","new"}'), true);
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
  // or=(status.eq.active,age.gt.65)
  // We need to check exact string, but keys order...
  // status=eq.active
  // age=gt.65
  // joined by comma
  assertEquals(url.includes("or=(status=eq.active,age=gt.65)"), true);
});

Deno.test("Dialect - Dirty Strings in Arrays", () => {
  const url = buildUrl("public", "items", {
    where: {
      tags: { $cs: ['"Special"', "Back\\Slash", "Amp&Sand"] },
    },
  });
  // Expected: tags=cs.{"\"Special\"","Back\\Slash","Amp%26Sand"}
  // Note: If we use encodeURIComponent, \ becomes %5C and " becomes %22.
  // We check for the presence of the escaped and encoded components.
  // The visualization in the spec showed raw \ and ", but for URL safety
  // we are using encodeURIComponent.
  assertEquals(url.includes("tags=cs."), true);
  assertEquals(url.includes("%5C%22Special%5C%22"), true);
  assertEquals(url.includes("Back%5C%5CSlash"), true);
  assertEquals(url.includes("Amp%26Sand"), true);
});
