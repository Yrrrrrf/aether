import type { ValidationStrategy } from "../validation/types.ts";

/**
 * Supported database operators matching PostgREST filters.
 *
 * @see https://postgrest.org/en/stable/api.html#operators
 *
 * @example
 *
 * $eq -> =
 * $gt -> >
 * $gte -> >=
 * $lt -> <
 * $lte -> <=
 * $neq -> !=
 * $like -> LIKE
 * $ilike -> ILIKE
 * $in -> IN
 * $is -> IS
 * $cs -> <@ (contained by)
 * $cd -> @> (contains)
 * $ov -> && (overlaps)
 * $sl -> << (strictly less than)
 * $sr -> >> (strictly greater than)
 * $nxr -> &< (does not extend to the right of)
 * $nxl -> &> (does not extend to the left of)
 * $adj -> -|- (adjacent to)
 * $not -> ! (not)
 * $or -> | (or)
 * $and -> & (and)
 */
export type Operator =
  | "$eq"
  | "$gt"
  | "$gte"
  | "$lt"
  | "$lte"
  | "$neq"
  | "$like"
  | "$ilike"
  | "$in"
  | "$is"
  | "$cs"
  | "$cd"
  | "$ov"
  | "$sl"
  | "$sr"
  | "$nxr"
  | "$nxl"
  | "$adj"
  | "$not"
  | "$or"
  | "$and";

/**
 * Represents a recursive filter object compatible with the DSL.
 */
export interface QueryFilter {
  /** Nested logical or operator filter values */
  [key: string]: unknown | Record<string, unknown> | QueryFilter[];
}

/**
 * Options mapped to PostgREST modifiers (select, limit, order, etc).
 */
export interface QueryOptions<T = unknown> {
  /** The columns to select, defaults to '*' */
  select?: string[];
  /** PostgREST-style filter criteria map */
  where?: QueryFilter;
  /** Sorting instructions */
  order?:
    | string[]
    | Record<
      string,
      "asc" | "desc" | { dir: "asc" | "desc"; nulls?: "first" | "last" }
    >;
  /** The maximum number of rows to return */
  limit?: number;
  /** The number of rows to skip */
  offset?: number;
  /** Whether to ensure only a single object is returned */
  single?: boolean;
  /** Eager-loading rules mapping relation keys to QueryOptions */
  embed?: Record<string, QueryOptions | true>;
  /** Return total record count using specific strategies */
  count?: "exact" | "planned" | "estimated";
  /** Full-text search configuration */
  textSearch?: { column: string; query: string; config?: string };
  /** Validation strategy overrides for this specific query */
  validate?: ValidationStrategy<T>;
}

/**
 * Evaluates embedded relationship nodes conditionally up to 1 level deep.
 * Deeply nested recursive relations fall back to Partial<R> bounds to preserve
 * Type stability and mitigate infinite compiler inferences.
 */
export type WithEmbed<T, R, O> = O extends { embed: infer E }
  // deno-lint-ignore no-explicit-any
  ? E extends Record<string, any> ?
      & T
      & Omit<R, keyof E>
      & { [K in Extract<keyof E, keyof R>]-?: NonNullable<R[K]> }
  : T & R
  : T & Partial<R>;

/**
 * Read-only operations available on database Views and Tables.
 */
export interface ViewOperations<T = unknown, R = unknown> {
  /**
   * Fetches multiple rows matching the optional query options.
   * @param query - Configuration for filtering, sorting, limits, etc.
   */
  findMany<O extends QueryOptions<T> = QueryOptions<T>>(
    query?: O,
  ): Promise<WithEmbed<T, R, O>[]>;

  /**
   * Fetches a single row matching the optional query options.
   * returns null if no rows are found.
   * @param query - Configuration for filtering, sorting, limits, etc.
   */
  findOne<O extends QueryOptions<T> = QueryOptions<T>>(
    query?: O,
  ): Promise<WithEmbed<T, R, O> | null>;
}

/**
 * Read and write operations available on database Tables.
 */
export interface TableOperations<T = unknown, R = unknown>
  extends ViewOperations<T, R> {
  /**
   * Inserts one or more new rows into the table.
   * @param data - The row(s) to insert.
   */
  create(data: Partial<T> | Partial<T>[]): Promise<T[]>;
  /**
   * Updates rows matching the specified filter.
   * @param filter - The condition to match rows for update.
   * @param data - The partial data to apply.
   */
  update(filter: QueryFilter, data: Partial<T>): Promise<T[]>;
  /**
   * Deletes rows matching the specified filter.
   * @param filter - The condition to match rows for deletion.
   */
  delete(filter: QueryFilter): Promise<void>;
}
