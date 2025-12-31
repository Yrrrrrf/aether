export interface Column {
  name: string;
  dataType: string;
  udtName: string; // underlying type name (e.g. for enums)
  isNullable: boolean;
  hasDefault: boolean;
  comment?: string;
}

export interface ForeignKey {
  column: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
}

export interface Table {
  name: string;
  schema: string;
  isView: boolean;
  columns: Column[];
  primaryKeys: string[];
  foreignKeys: ForeignKey[];
}

export interface Enum {
  schema: string;
  name: string;
  values: string[];
}

export interface DatabaseSchema {
  tables: Table[];
  enums: Enum[];
}
