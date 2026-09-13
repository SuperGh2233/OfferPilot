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
    expect(
      algorithmCatalog.every((problem) => {
        const detail = getAlgorithmProblem(problem.id);
        return Boolean(detail?.statement.trim() && detail.javaStarterCode.trim());
      }),
    ).toBe(true);
    expect(getAlgorithmProblem("1")).toMatchObject({
      leetcodeId: 1,
      title: "两数之和",
      difficulty: "easy",
    });
  });

  it("maps Group Anagrams to its Java starter signature", () => {
    expect(getAlgorithmProblem("49")).toMatchObject({
      leetcodeId: 49,
      title: "字母异位词分组",
      javaStarterCode: expect.stringContaining(
        "List<List<String>> groupAnagrams(String[] strs)",
      ),
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
