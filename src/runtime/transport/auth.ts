import type { AetherConfig } from "../core/fabric.ts";

export function isPostgrestDialect(config: AetherConfig): boolean {
  return config.dialect === "postgrest" || config.dialect === "supabase" ||
    !!config.apiKey;
}

export function resolveAuthHeaders(
  config: AetherConfig,
): Record<string, string> {
  const headers: Record<string, string> = { ...config.headers };

  if (isPostgrestDialect(config)) {
    if (config.apiKey) {
      headers["apikey"] = config.apiKey;
    }
    if (config.getAccessToken) {
      const token = config.getAccessToken();
      if (token !== null) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    if (config.schema && config.schema !== "public") {
      headers["Accept-Profile"] = config.schema;
    }
  }

  return headers;
}

export function resolveWriteHeaders(
  config: AetherConfig,
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (isPostgrestDialect(config)) {
    headers["Prefer"] = "return=representation";
    if (config.schema && config.schema !== "public") {
      headers["Content-Profile"] = config.schema;
    }
  }

  return headers;
}
