import { assertEquals, assertFalse } from "@std/assert";
import {
  resolveAuthHeaders,
  resolveWriteHeaders,
} from "../../src/runtime/transport/auth.ts";
import type { AetherConfig } from "../../src/runtime/core/fabric.ts";

Deno.test("Auth Headers - API Key Only", () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "supabase",
    apiKey: "test-key",
  };
  const headers = resolveAuthHeaders(config);
  assertEquals(headers["apikey"], "test-key");
  assertFalse("Authorization" in headers);
});

Deno.test("Auth Headers - API Key + JWT", () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "supabase",
    apiKey: "test-key",
    getAccessToken: () => "jwt-token",
  };
  const headers = resolveAuthHeaders(config);
  assertEquals(headers["apikey"], "test-key");
  assertEquals(headers["Authorization"], "Bearer jwt-token");
});

Deno.test("Auth Headers - JWT is Null", () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "supabase",
    apiKey: "test-key",
    getAccessToken: () => null,
  };
  const headers = resolveAuthHeaders(config);
  assertEquals(headers["apikey"], "test-key");
  assertFalse("Authorization" in headers);
});

Deno.test("Auth Headers - Schema Private", () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "postgrest",
    schema: "private",
  };
  const headers = resolveAuthHeaders(config);
  assertEquals(headers["Accept-Profile"], "private");
});

Deno.test("Auth Headers - No PostgREST Config (pREST fallback)", () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
  };
  const headers = resolveAuthHeaders(config);
  assertEquals(Object.keys(headers).length, 0);
});

Deno.test("Auth Headers - Includes Custom Headers", () => {
  const config: AetherConfig = {
    baseUrl: "http://localhost:3000",
    dialect: "supabase",
    apiKey: "test-key",
    headers: {
      "X-Custom-Token": "hello",
    },
  };
  const headers = resolveAuthHeaders(config);
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
