import hot100Snapshot from "../../data/algorithm/hot100.json";

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
  return algorithmCatalog.find((problem) => problem.id === id);
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
