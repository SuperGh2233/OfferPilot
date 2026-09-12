import { describe, expect, it } from "vitest";

import {
  algorithmCatalog,
  algorithmTags,
  getAlgorithmProblem,
  toAlgorithmPlannerProblem,
} from "../lib/algorithm/catalog";

describe("algorithm catalog", () => {
  it("maps the 100-item snapshot to stable client-facing ids", () => {
    expect(algorithmCatalog).toHaveLength(100);
    expect(new Set(algorithmCatalog.map((problem) => problem.id)).size).toBe(100);
    expect(getAlgorithmProblem("1")).toMatchObject({
      leetcodeId: 1,
      title: "两数之和",
      difficulty: "easy",
    });
  });

  it("provides unique tags and planner-shaped problems", () => {
    expect(new Set(algorithmTags).size).toBe(algorithmTags.length);
    expect(algorithmTags).toContain("数组");
    expect(toAlgorithmPlannerProblem(algorithmCatalog[0])).toEqual({
      id: "1",
      tags: algorithmCatalog[0].tags,
      recommendedWeek: 1,
      importance: 3,
      orderIndex: 1,
    });
  });
});
