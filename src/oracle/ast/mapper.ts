/**
 * Maps PostgreSQL data types to TypeScript types.
 *
 * @param dataType - The PostgreSQL data type (e.g., 'integer', 'text').
 * @param udtName - The user-defined type name (useful for enums or arrays).
 * @param _enums - A set of known enum names in the schema.
 * @returns The corresponding TypeScript type string.
 */
export function mapPostgresTypeToTs(
  dataType: string,
  udtName: string,
  enums: Set<string>, // Set of enum names (schema.name)
): string {
  // Check if it's an array
  if (dataType === "ARRAY" || udtName.startsWith("_")) {
    const innerUdtName = udtName.startsWith("_") ? udtName.slice(1) : udtName;
    const innerType = mapPostgresTypeToTs(innerUdtName, innerUdtName, enums);
    return `${innerType}[]`;
  }

  // Check if it's a known enum
  if (enums.has(udtName)) {
    return udtName.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(
      "",
    );
  }

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
      console.warn(
        `[Oracle] Unmapped type: dataType="${dataType}", udtName="${udtName}". Falling back to "string".`,
      );
      return "string";
  }
}
