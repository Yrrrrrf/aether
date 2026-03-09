import type { QueryFilter, QueryOptions } from "./types.ts";

export type QueryState = {
  hasTable?: true;
  hasFilter?: true;
};

export class AetherQueryBuilder<
  T = unknown,
  State extends QueryState = Record<string, never>,
> {
  private opts: Partial<QueryOptions<T>> = {};

  /**
   * Applies a filter condition to the query. This method is required before calling `build()`.
   * @param filter - A strongly typed filter object using PostgREST operators.
   * @returns The builder instance with a narrowed typestate indicating a filter is present.
   */
  where(
    filter: QueryFilter<T>,
  ): AetherQueryBuilder<T, State & { hasFilter: true }> {
    this.opts.where = filter;
    // deno-lint-ignore no-explicit-any
    return this as any;
  }

  /**
   * Specifies which columns to return in the result set.
   * @param fields - A list of column names (keys of T) to select.
   * @returns The builder instance for chaining.
   */
  select<K extends keyof T>(...fields: K[]): AetherQueryBuilder<T, State> {
    this.opts.select = fields as string[];
    return this;
  }

  /**
   * Limits the number of rows returned by the query.
   * @param n - The maximum number of rows to return.
   * @returns The builder instance for chaining.
   */
  limit(n: number): AetherQueryBuilder<T, State> {
    this.opts.limit = n;
    return this;
  }

  /**
   * Specifies the sorting order for the query results.
   * @param field - The column name to sort by.
   * @param dir - The sort direction ("asc" or "desc"). Defaults to "asc".
   * @returns The builder instance for chaining.
   */
  order(
    field: keyof T,
    dir: "asc" | "desc" = "asc",
  ): AetherQueryBuilder<T, State> {
    this.opts.order = { [field as string]: dir };
    return this;
  }

  /**
   * Defines eager-loading rules for fetching related records.
   * @param relations - An object mapping relationship keys to their respective query options.
   * @returns The builder instance for chaining.
   */
  embed<R>(
    relations: Record<keyof R, QueryOptions | true>,
  ): AetherQueryBuilder<T, State> {
    // deno-lint-ignore no-explicit-any
    this.opts.embed = relations as any;
    return this;
  }

  /**
   * Applies a full-text search condition to the query.
   * @param column - The column name to search within.
   * @param query - The text string to search for.
   * @param config - Optional configuration name for the text search.
   * @returns The builder instance for chaining.
   */
  search(
    column: keyof T,
    query: string,
    config?: string,
  ): AetherQueryBuilder<T, State> {
    this.opts.textSearch = { column: column, query, config };
    return this;
  }

  /**
   * Finalizes the builder and returns the underlying `QueryOptions` object.
   *
   * **Typestate Check:** This method can only be called if `where()` has been called previously,
   * preventing accidental operations on the entire table.
   *
   * @returns The fully constructed QueryOptions object.
   */
  build(this: AetherQueryBuilder<T, { hasFilter: true }>): QueryOptions<T> {
    return this.opts as QueryOptions<T>;
  }
}
