import hot100Snapshot from "../../data/algorithm/hot100.json";
import hot100Content from "../../data/algorithm/hot100-content.json";

import type { AlgorithmDifficulty } from "../mastery/algorithm";
import type { AlgorithmPlannerProblem } from "../planner/algorithm";

export type AlgorithmCatalogProblem = {
  id: string;
  leetcodeId: number;
  title: string;
  titleEn: string;
  difficulty: AlgorithmDifficulty;
  url: string;
  tags: readonly string[];
  recommendedWeek: number;
  importance: number;
  orderIndex: number;
};

export type AlgorithmTrainingProblem = AlgorithmCatalogProblem & {
  statement: string;
  javaStarterCode: string;
};

type Hot100ContentProblem = {
  leetcode_id: number;
  statement: string;
  java_starter_code: string;
};

const hot100ContentProblems =
  hot100Content.problems as readonly Hot100ContentProblem[];
const hot100ContentById = new Map<number, Hot100ContentProblem>();

for (const content of hot100ContentProblems) {
  if (hot100ContentById.has(content.leetcode_id)) {
    throw new Error(
      `Duplicate Hot 100 content for LeetCode #${content.leetcode_id}`,
    );
  }
  if (
    content.statement.trim().length === 0 ||
    content.java_starter_code.trim().length === 0
  ) {
    throw new Error(
      `Hot 100 content is incomplete for LeetCode #${content.leetcode_id}`,
    );
  }
  hot100ContentById.set(content.leetcode_id, content);
}

const hot100SnapshotIds = new Set(
  hot100Snapshot.problems.map((problem) => problem.leetcode_id),
);
const missingHot100Content = hot100Snapshot.problems
  .filter((problem) => !hot100ContentById.has(problem.leetcode_id))
  .map((problem) => problem.leetcode_id);
const extraHot100Content = hot100ContentProblems
  .filter((content) => !hot100SnapshotIds.has(content.leetcode_id))
  .map((content) => content.leetcode_id);

if (
  hot100ContentProblems.length !== hot100Snapshot.problems.length ||
  missingHot100Content.length > 0 ||
  extraHot100Content.length > 0
) {
  throw new Error(
    `Hot 100 content must map exactly to the snapshot (missing: ${missingHot100Content.join(",") || "none"}; extra: ${extraHot100Content.join(",") || "none"})`,
  );
}

export const algorithmCatalog: readonly AlgorithmCatalogProblem[] =
  hot100Snapshot.problems.map((problem) => ({
    id: String(problem.leetcode_id),
    leetcodeId: problem.leetcode_id,
    title: problem.title,
    titleEn: problem.title_en,
    difficulty: problem.difficulty as AlgorithmDifficulty,
    url: problem.url,
    tags: problem.tags,
    recommendedWeek: problem.recommended_week,
    importance: problem.importance,
    orderIndex: problem.order_index,
  }));

export const algorithmTags = [
  ...new Set(algorithmCatalog.flatMap((problem) => problem.tags)),
].sort((left, right) => left.localeCompare(right, "zh-CN"));

export function getAlgorithmProblem(id: string) {
  const problem = algorithmCatalog.find((item) => item.id === id);
  if (!problem) return undefined;

  const content = hot100ContentById.get(problem.leetcodeId);
  if (!content) {
    throw new Error(`Missing Hot 100 content for LeetCode #${problem.leetcodeId}`);
  }

  return {
    ...problem,
    statement: content.statement,
    javaStarterCode: content.java_starter_code,
  } satisfies AlgorithmTrainingProblem;
}

export function toAlgorithmPlannerProblem(
  problem: AlgorithmCatalogProblem,
): AlgorithmPlannerProblem {
  return {
    id: problem.id,
    tags: problem.tags,
    recommendedWeek: problem.recommendedWeek,
    importance: problem.importance,
    orderIndex: problem.orderIndex,
  };
}
