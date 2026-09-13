import { describe, expect, it } from "vitest";

import { algorithmCatalog } from "../lib/algorithm/catalog";
import { createAlgorithmDemoData } from "../lib/algorithm/demo-store";
import {
  importCompletedAlgorithmProblems,
  parseAlgorithmImport,
} from "../lib/algorithm/import-progress";

describe("algorithm progress import", () => {
  it("matches common pasted formats and imports a conservative reviewable state", () => {
    const preview = parseAlgorithmImport(
      [
        "✓ [1]两数之和 55.2%",
        "https://leetcode.cn/problems/group-anagrams/",
        "3",
        "不是 Hot 100",
        "[1]重复项",
      ].join("\n"),
      algorithmCatalog,
    );
    expect(preview.problemIds).toEqual(["1", "49", "3"]);
    expect(preview.unmatchedEntries).toEqual(["不是 Hot 100"]);

    const data = createAlgorithmDemoData("2026-09-13");
    data.dailyTasks["2026-09-13"] = [{
      problemId: "1",
      taskType: "new",
      reason: "week_1_new",
      sortOrder: 0,
      date: "2026-09-13",
      status: "pending",
      completedAt: null,
    }];
    const imported = importCompletedAlgorithmProblems({
      data,
      problemIds: preview.problemIds,
      importedAt: "2026-09-13T04:00:00.000Z",
      userId: "user-1",
    });

    expect(imported.importedCount).toBe(3);
    expect(imported.data.attempts).toEqual([]);
    expect(imported.data.states["1"]).toMatchObject({
      mastery: 60,
      attemptCount: 1,
      status: "learning",
      nextReviewAt: "2026-09-16T04:00:00.000Z",
    });
    expect(imported.data.dailyTasks["2026-09-13"][0]).toMatchObject({
      status: "completed",
      completedAt: "2026-09-13T04:00:00.000Z",
    });

    const repeated = importCompletedAlgorithmProblems({
      data: imported.data,
      problemIds: ["1"],
      importedAt: "2026-09-14T04:00:00.000Z",
      userId: "user-1",
    });
    expect(repeated.importedCount).toBe(0);
    expect(repeated.skippedCount).toBe(1);
    expect(repeated.data).toBe(imported.data);
  });
});
