import type { AlgorithmMistakeTag } from "../mastery/algorithm";

export const ALGORITHM_SOLUTION_TYPES = [
  "brute_force",
  "hashing",
  "two_pointers",
  "sliding_window",
  "binary_search",
  "dynamic_programming",
  "graph_tree",
  "other",
] as const;

export type AlgorithmSolutionType = (typeof ALGORITHM_SOLUTION_TYPES)[number];

export const AI_WEAKNESS_TAGS = [
  "no_idea",
  "wrong_idea",
  "boundary",
  "pointer",
  "state",
  "java_syntax",
  "java_api",
  "data_structure",
  "complexity",
  "careless",
] as const satisfies readonly AlgorithmMistakeTag[];

export type AlgorithmCodeAnalysis = {
  solutionType: AlgorithmSolutionType;
  complexity: {
    time: string;
    space: string;
  };
  summary: string;
  mistakes: string[];
  weaknessTags: AlgorithmMistakeTag[];
  goodPoints: string[];
  minimalChanges: string[];
};

export const algorithmCodeAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "solutionType",
    "complexity",
    "summary",
    "mistakes",
    "weaknessTags",
    "goodPoints",
    "minimalChanges",
  ],
  properties: {
    solutionType: { type: "string", enum: [...ALGORITHM_SOLUTION_TYPES] },
    complexity: {
      type: "object",
      additionalProperties: false,
      required: ["time", "space"],
      properties: {
        time: { type: "string" },
        space: { type: "string" },
      },
    },
    summary: { type: "string" },
    mistakes: { type: "array", items: { type: "string" } },
    weaknessTags: {
      type: "array",
      items: { type: "string", enum: [...AI_WEAKNESS_TAGS] },
    },
    goodPoints: { type: "array", items: { type: "string" } },
    minimalChanges: { type: "array", items: { type: "string" } },
  },
} as const;

const ANALYSIS_KEYS = [
  "solutionType",
  "complexity",
  "summary",
  "mistakes",
  "weaknessTags",
  "goodPoints",
  "minimalChanges",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 8 &&
    value.every(
      (item) => typeof item === "string" && item.trim().length > 0 && item.length <= 500,
    )
  );
}

export function isAlgorithmCodeAnalysis(value: unknown): value is AlgorithmCodeAnalysis {
  if (!isRecord(value) || !hasExactKeys(value, ANALYSIS_KEYS)) return false;
  if (!ALGORITHM_SOLUTION_TYPES.includes(value.solutionType as AlgorithmSolutionType)) return false;
  if (
    typeof value.summary !== "string" ||
    value.summary.trim().length === 0 ||
    value.summary.length > 1_000
  ) return false;
  if (!isRecord(value.complexity) || !hasExactKeys(value.complexity, ["time", "space"])) return false;
  if (
    typeof value.complexity.time !== "string" ||
    value.complexity.time.trim().length === 0 ||
    value.complexity.time.length > 100 ||
    typeof value.complexity.space !== "string" ||
    value.complexity.space.trim().length === 0 ||
    value.complexity.space.length > 100
  ) {
    return false;
  }
  if (!isStringArray(value.mistakes) || !isStringArray(value.goodPoints) || !isStringArray(value.minimalChanges)) {
    return false;
  }
  return (
    Array.isArray(value.weaknessTags) &&
    value.weaknessTags.length <= AI_WEAKNESS_TAGS.length &&
    value.weaknessTags.every((tag) => AI_WEAKNESS_TAGS.includes(tag as AlgorithmMistakeTag))
  );
}

export function parseAlgorithmCodeAnalysis(value: unknown): AlgorithmCodeAnalysis {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!isAlgorithmCodeAnalysis(parsed)) {
    throw new TypeError("AI response does not match the code analysis schema");
  }
  return parsed;
}
