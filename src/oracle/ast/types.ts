/**
 * Represents a parsed database column struct.
 */
export interface Column {
  /** The column name */
  name: string;
  /** The PostgreSQL data type string */
  dataType: string;
  /** The underlying user-defined type name (e.g. for enums or arrays) */
  udtName: string;
  /** Whether the column accepts null values */
  isNullable: boolean;
  /** Whether the column has a default value defined */
  hasDefault: boolean;
  /** Optional database comment/description for the column */
  comment?: string;
}

/**
 * Represents a parsed foreign key relationship.
 */
export interface ForeignKey {
  /** The local column name */
  column: string;
  /** The target schema name */
  targetSchema: string;
  /** The target table name */
  targetTable: string;
  /** The target column name */
  targetColumn: string;
}

/**
 * Represents a parsed database table or view.
 */
export interface Table {
  /** The table name */
  name: string;
  /** The schema the table belongs to */
  schema: string;
  /** Whether this represents a database view */
  isView: boolean;
  /** The list of columns in the table */
  columns: Column[];
  /** The list of primary key column names */
  primaryKeys: string[];
  /** The list of foreign key relationships */
  foreignKeys: ForeignKey[];
}

/**
 * Represents a PostgreSQL ENUM type definition.
 */
export interface Enum {
  /** The schema the enum belongs to */
  schema: string;
  /** The enum type name */
  name: string;
  /** The list of valid enum values */
  values: string[];
}

/**
 * The top-level schema map introspected from the database.
 */
export interface DatabaseSchema {
  /** The list of extracted tables and views */
  tables: Table[];
  /** The list of extracted custom enum types */
  enums: Enum[];
}
