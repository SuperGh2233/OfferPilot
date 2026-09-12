export type KnowledgeKeywordAliases = Readonly<
  Record<string, readonly string[]>
>;

export type KnowledgePointWeights = Readonly<Record<string, number>>;

export type KnowledgeMatchedPoint = {
  index: number;
  point: string;
  weight: number;
  matchedBy: string;
};

export type KnowledgeMissingPoint = {
  index: number;
  point: string;
  weight: number;
};

export type KnowledgeMatchResult = {
  coverageScore: number;
  matchedWeight: number;
  totalWeight: number;
  matchedPoints: KnowledgeMatchedPoint[];
  missingPoints: KnowledgeMissingPoint[];
  source: "key_points" | "keyword_aliases" | "none";
};

export type MatchKnowledgeKeyPointsInput = {
  answer: string;
  keyPoints: readonly string[];
  keywordAliases?: KnowledgeKeywordAliases | null;
  keyPointWeights?: KnowledgePointWeights | null;
};

type MatchablePoint = {
  point: string;
  aliases: readonly string[];
  weight: number;
};

export function normalizeChineseText(text: string) {
  if (typeof text !== "string") {
    throw new RangeError("text must be a string");
  }

  return text
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function assertStringArray(value: unknown, name: string): asserts value is readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new RangeError(`${name} must be an array of strings`);
  }
}

function aliasGroups(keywordAliases: KnowledgeKeywordAliases | null | undefined) {
  const groups = new Map<string, { point: string; aliases: string[] }>();

  for (const [point, aliases] of Object.entries(keywordAliases ?? {})) {
    const normalizedPoint = normalizeChineseText(point);
    if (!normalizedPoint) throw new RangeError("alias keys must not be empty");
    assertStringArray(aliases, `keywordAliases.${point}`);

    const group = groups.get(normalizedPoint) ?? { point, aliases: [] };
    for (const alias of [point, ...aliases]) {
      if (!normalizeChineseText(alias)) continue;
      if (!group.aliases.includes(alias)) group.aliases.push(alias);
    }
    groups.set(normalizedPoint, group);
  }

  return groups;
}

function weightAt(
  index: number,
  weights: KnowledgePointWeights | null | undefined,
  fallbackAliases: boolean,
) {
  const value = weights?.[String(index)] ?? (fallbackAliases ? 5 : index === 0 ? 20 : 5);
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`keyPointWeights.${index} must be greater than 0`);
  }
  return value;
}

function buildPoints({
  keyPoints,
  keywordAliases,
  keyPointWeights,
}: Omit<MatchKnowledgeKeyPointsInput, "answer">): {
  points: MatchablePoint[];
  source: KnowledgeMatchResult["source"];
} {
  assertStringArray(keyPoints, "keyPoints");
  const groups = aliasGroups(keywordAliases);

  if (keyPoints.length > 0) {
    const normalizedPoints = keyPoints.map((point, index) => {
      const normalized = normalizeChineseText(point);
      if (!normalized) throw new RangeError(`keyPoints.${index} must not be empty`);
      return normalized;
    });
    const aliasesByPoint = new Map<number, readonly string[]>();
    for (const [normalizedAlias, group] of groups) {
      const exactIndexes = normalizedPoints
        .map((point, index) => (point === normalizedAlias ? index : -1))
        .filter((index) => index >= 0);
      const candidateIndexes = exactIndexes.length > 0
        ? exactIndexes
        : normalizedPoints
            .map((point, index) => (point.includes(normalizedAlias) ? index : -1))
            .filter((index) => index >= 0);
      if (candidateIndexes.length === 1) {
        aliasesByPoint.set(candidateIndexes[0], group.aliases);
      }
    }

    return {
      source: "key_points",
      points: keyPoints.map((point, index) => ({
        point,
        aliases: aliasesByPoint.get(index) ?? [point],
        weight: weightAt(index, keyPointWeights, false),
      })),
    };
  }

  const fallback = [...groups.values()].sort((left, right) =>
    left.point.localeCompare(right.point, "zh-CN"),
  );
  return {
    source: fallback.length > 0 ? "keyword_aliases" : "none",
    points: fallback.map((group, index) => ({
      ...group,
      weight: weightAt(index, keyPointWeights, true),
    })),
  };
}

export function matchKnowledgeKeyPoints({
  answer,
  keyPoints,
  keywordAliases,
  keyPointWeights,
}: MatchKnowledgeKeyPointsInput): KnowledgeMatchResult {
  const normalizedAnswer = normalizeChineseText(answer);
  const { points, source } = buildPoints({
    keyPoints,
    keywordAliases,
    keyPointWeights,
  });
  const matchedPoints: KnowledgeMatchedPoint[] = [];
  const missingPoints: KnowledgeMissingPoint[] = [];

  points.forEach((point, index) => {
    const matchedBy = point.aliases.find((alias) => {
      const normalizedAlias = normalizeChineseText(alias);
      return normalizedAlias.length > 0 && normalizedAnswer.includes(normalizedAlias);
    });

    if (matchedBy) {
      matchedPoints.push({ index, point: point.point, weight: point.weight, matchedBy });
    } else {
      missingPoints.push({ index, point: point.point, weight: point.weight });
    }
  });

  const totalWeight = points.reduce((sum, point) => sum + point.weight, 0);
  const matchedWeight = matchedPoints.reduce((sum, point) => sum + point.weight, 0);

  return {
    coverageScore: totalWeight === 0 ? 0 : Math.round((matchedWeight / totalWeight) * 100),
    matchedWeight,
    totalWeight,
    matchedPoints,
    missingPoints,
    source,
  };
}
