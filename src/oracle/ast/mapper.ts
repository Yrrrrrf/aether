export function mapPostgresTypeToTs(
  dataType: string,
  udtName: string,
  enums: Set<string>, // Set of enum names (schema.name)
): string {
  // Check if it's an array
  if (dataType === "ARRAY") {
    // udtName starts with _ for arrays usually, e.g. _int4
    const innerType = udtName.startsWith("_") ? udtName.slice(1) : udtName;
    // We need to map the inner type recursively?
    // This is a naive check. A better way is to look at standard array types.
    // For now, let's return "unknown[]" if we're unsure, or try to map common ones.
    if (innerType === "text" || innerType === "varchar") return "string[]";
    if (innerType === "int4" || innerType === "int8") return "number[]";
    return "unknown[]";
  }

  // Check if it's a known enum
  // udtName matches the enum name? Note: Postgres might strip schema or not.
  // In introspection we stored enums as "schema.name".
  // udtName usually comes as "name" if it's in the search path.
  // We'll rely on strict matching if possible, but for now check if udtName is in our enum set keys (without schema?)
  // Actually, let's just use the dataType logic first.

  switch (dataType) {
    case "boolean":
      return "boolean";
    case "integer":
    case "smallint":
    case "real":
    case "double precision":
    case "numeric": // can be large, but often number is desired.
      return "number";
    case "bigint":
      // Safe implementation: string (to avoid overflow)
      return "string";
    case "text":
    case "character varying":
    case "character":
    case "uuid":
    case "timestamp with time zone":
    case "timestamp without time zone":
    case "date":
    case "time without time zone":
    case "interval":
    case "inet":
    case "cidr":
    case "macaddr":
      return "string";
    case "json":
    case "jsonb":
      return "Json";
    default:
      // Is it a user-defined type (Enum)?
      // If we had the schema context, we'd check `schema.udtName`.
      // For now, return "string" or "unknown".
      // If we passed the full list of enums, we could check.
      return "unknown";
  }
}
