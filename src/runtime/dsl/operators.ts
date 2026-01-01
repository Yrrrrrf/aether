export type OperatorFormat = "scalar" | "parens" | "braces";

export interface OperatorConfig {
  token: string;
  format: OperatorFormat;
}

export const OPERATOR_MAP: Record<string, OperatorConfig> = {
  // pREST requires '$' prefix for operators
  $eq: { token: "$eq", format: "scalar" },
  $gt: { token: "$gt", format: "scalar" },
  $gte: { token: "$gte", format: "scalar" },
  $lt: { token: "$lt", format: "scalar" },
  $lte: { token: "$lte", format: "scalar" },
  $neq: { token: "$ne", format: "scalar" }, // pREST uses $ne
  $like: { token: "$like", format: "scalar" },
  $ilike: { token: "$ilike", format: "scalar" },

  // Note: pREST uses specific params for is/null, we map to $eq for simplicity or custom
  $is: { token: "$eq", format: "scalar" },

  // Parenthesis formatted operators
  $in: { token: "$in", format: "parens" },
  "$not.in": { token: "$nin", format: "parens" },

  // Braces formatted operators (Arrays/Ranges) - pREST specific support might vary
  // keeping these as standard PostgREST for now, or mapping if pREST supports them
  $cs: { token: "$cs", format: "braces" },
  $cd: { token: "$cd", format: "braces" },
  $ov: { token: "$ov", format: "braces" },
  $sl: { token: "$sl", format: "braces" },
  $sr: { token: "$sr", format: "braces" },
  $nxr: { token: "$nxr", format: "braces" },
  $nxl: { token: "$nxl", format: "braces" },
  $adj: { token: "$adj", format: "braces" },

  $not: { token: "$not", format: "scalar" },
  $or: { token: "$or", format: "parens" },
  $and: { token: "$and", format: "parens" },
};
