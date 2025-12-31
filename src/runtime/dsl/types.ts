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

export interface QueryOptions<T = any> {
  select?: string[];
  where?: QueryFilter;
  order?: string[] | Record<string, "asc" | "desc">;
  limit?: number;
  offset?: number;
  single?: boolean;
}

export interface ViewOperations<T = unknown, R = unknown> {
  findMany(query?: QueryOptions<T>): Promise<(T & R)[]>;
  findOne(query?: QueryOptions<T>): Promise<(T & R) | null>;
}

export interface TableOperations<T = unknown, R = unknown> extends ViewOperations<T, R> {
  create(data: Partial<T> | Partial<T>[]): Promise<T[]>;
  update(filter: QueryFilter, data: Partial<T>): Promise<T[]>;
  delete(filter: QueryFilter): Promise<void>;
}
