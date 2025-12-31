export type OperatorFormat = "scalar" | "parens" | "braces";

export interface OperatorConfig {
  token: string;
  format: OperatorFormat;
}

export const OPERATOR_MAP: Record<string, OperatorConfig> = {
  $eq: { token: "eq", format: "scalar" },
  $gt: { token: "gt", format: "scalar" },
  $gte: { token: "gte", format: "scalar" },
  $lt: { token: "lt", format: "scalar" },
  $lte: { token: "lte", format: "scalar" },
  $neq: { token: "neq", format: "scalar" },
  $like: { token: "like", format: "scalar" },
  $ilike: { token: "ilike", format: "scalar" },
  $is: { token: "is", format: "scalar" },

  // Parenthesis formatted operators
  $in: { token: "in", format: "parens" },
  "$not.in": { token: "not.in", format: "parens" }, // Assuming we support this key if user uses string key

  // Braces formatted operators (Arrays/Ranges)
  $cs: { token: "cs", format: "braces" },
  $cd: { token: "cd", format: "braces" },
  $ov: { token: "ov", format: "braces" },
  $sl: { token: "sl", format: "braces" },
  $sr: { token: "sr", format: "braces" },
  $nxr: { token: "nxr", format: "braces" },
  $nxl: { token: "nxl", format: "braces" },
  $adj: { token: "adj", format: "braces" },

  // Logical - these are structural but if used as values...
  $not: { token: "not", format: "scalar" },
  $or: { token: "or", format: "parens" }, // Usually handled structurally
  $and: { token: "and", format: "parens" },
};
