import type { ValidationStrategy } from "../validation/types.ts";

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

export interface QueryFilter {
  [key: string]: unknown | Record<string, unknown> | QueryFilter[];
}

export interface QueryOptions<T = unknown> {
  select?: string[];
  where?: QueryFilter;
  order?:
    | string[]
    | Record<
      string,
      "asc" | "desc" | { dir: "asc" | "desc"; nulls?: "first" | "last" }
    >;
  limit?: number;
  offset?: number;
  single?: boolean;
  embed?: Record<string, QueryOptions | true>;
  count?: "exact" | "planned" | "estimated";
  textSearch?: { column: string; query: string; config?: string };
  validate?: ValidationStrategy;
}

export type WithEmbed<T, R, O> = O extends { embed: infer E }
  // deno-lint-ignore no-explicit-any
  ? E extends Record<string, any> ?
      & T
      & Omit<R, keyof E>
      & { [K in Extract<keyof E, keyof R>]-?: NonNullable<R[K]> }
  : T & R
  : T & Partial<R>;

export interface ViewOperations<T = unknown, R = unknown> {
  findMany<O extends QueryOptions<T> = QueryOptions<T>>(
    query?: O,
  ): Promise<WithEmbed<T, R, O>[]>;
  findOne<O extends QueryOptions<T> = QueryOptions<T>>(
    query?: O,
  ): Promise<WithEmbed<T, R, O> | null>;
}

export interface TableOperations<T = unknown, R = unknown>
  extends ViewOperations<T, R> {
  create(data: Partial<T> | Partial<T>[]): Promise<T[]>;
  update(filter: QueryFilter, data: Partial<T>): Promise<T[]>;
  delete(filter: QueryFilter): Promise<void>;
}
