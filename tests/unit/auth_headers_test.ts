import { assertEquals, assertFalse } from "@std/assert";
import { resolveClientHeaders } from "../../src/runtime/transport/client.ts";
import { resolveWriteHeaders } from "../../src/runtime/core/fabric.ts";
import type { AetherConfig } from "../../src/runtime/core/fabric.ts";
import { tokenAdapter } from "../../src/runtime/auth/adapters.ts";

Deno.test("Auth Headers - API Key Only", async () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "supabase",
    apiKey: "test-key",
  };
  const headers = await resolveClientHeaders(config);
  assertEquals(headers["apikey"], "test-key");
  assertFalse("Authorization" in headers);
});

Deno.test("Auth Headers - API Key + JWT", async () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "supabase",
    apiKey: "test-key",
    auth: tokenAdapter(() => "jwt-token"),
  };
  const headers = await resolveClientHeaders(config);
  assertEquals(headers["apikey"], "test-key");
  assertEquals(headers["Authorization"], "Bearer jwt-token");
});

Deno.test("Auth Headers - JWT is Null", async () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "supabase",
    apiKey: "test-key",
    auth: tokenAdapter(() => null),
  };
  const headers = await resolveClientHeaders(config);
  assertEquals(headers["apikey"], "test-key");
  assertFalse("Authorization" in headers);
});

Deno.test("Auth Headers - Schema Private", async () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "postgrest",
    schema: "private",
  };
  const headers = await resolveClientHeaders(config);
  assertEquals(headers["Accept-Profile"], "private");
});

Deno.test("Auth Headers - No PostgREST Config (pREST fallback)", async () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
  };
  const headers = await resolveClientHeaders(config);
  // Content-Type application/json is always injected by builder natively but we test what resolves
  assertEquals(headers["Content-Type"], "application/json");
  assertFalse("apikey" in headers);
});

Deno.test("Auth Headers - Includes Custom Headers", async () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "supabase",
    apiKey: "test-key",
    headers: {
      "X-Custom-Token": "hello",
    },
  };
  const headers = await resolveClientHeaders(config);
  assertEquals(headers["apikey"], "test-key");
  assertEquals(headers["X-Custom-Token"], "hello");
});

Deno.test("Write Headers - PostgREST Default", () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "postgrest",
  };
  const headers = resolveWriteHeaders(config);
  assertEquals(headers["Prefer"], "return=representation");
});

Deno.test("Write Headers - PostgREST with Private Schema", () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "postgrest",
    schema: "private",
  };
  const headers = resolveWriteHeaders(config);
  assertEquals(headers["Prefer"], "return=representation");
  assertEquals(headers["Content-Profile"], "private");
});

Deno.test("Write Headers - pREST", () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
  };
  const headers = resolveWriteHeaders(config);
  assertEquals(Object.keys(headers).length, 0);
});
