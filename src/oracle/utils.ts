export function toPascalCase(str: string): string {
  return str
    .replace(/_(\w)/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

export function toInterfaceName(schema: string, table: string): string {
  return toPascalCase(`${schema}_${table}`);
}

export function toSchemaName(schema: string, table: string): string {
  return `${toInterfaceName(schema, table)}Schema`;
}
