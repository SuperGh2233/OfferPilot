import { describe, expect, it } from "vitest";

import {
  nextTrainingTaskLabel,
  selectNextTrainingTask,
} from "../lib/progress/next-task";

const catalog = [
  { id: "a", order: 1 },
  { id: "b", order: 2 },
  { id: "c", order: 3 },
  { id: "d", order: 4 },
];

describe("selectNextTrainingTask", () => {
  it("prefers another unfinished task from today's queue in sort order", () => {
    expect(selectNextTrainingTask({
      currentId: "a",
      todayKey: "2026-09-21",
      now: Date.parse("2026-09-21T12:00:00.000Z"),
      catalog,
      tasks: [
        { id: "a", date: "2026-09-21", status: "completed", sortOrder: 1, taskType: "new" },
        { id: "c", date: "2026-09-21", status: "pending", sortOrder: 3, taskType: "new" },
        { id: "b", date: "2026-09-21", status: "pending", sortOrder: 2, taskType: "review" },
        { id: "d", date: "2026-09-20", status: "pending", sortOrder: 1, taskType: "new" },
      ],
      states: [],
    })).toEqual({ id: "b", source: "today", date: "2026-09-21", taskType: "review" });
  });

  it("can prefer another new-learning item within today's queue after Learn", () => {
    expect(selectNextTrainingTask({
      currentId: "a",
      todayKey: "2026-09-21",
      now: Date.parse("2026-09-21T12:00:00.000Z"),
      preferredTaskType: "new",
      catalog,
      tasks: [
        { id: "b", date: "2026-09-21", status: "pending", sortOrder: 1, taskType: "review" },
        { id: "c", date: "2026-09-21", status: "pending", sortOrder: 2, taskType: "new" },
      ],
      states: [],
    })).toEqual({ id: "c", source: "today", date: "2026-09-21", taskType: "new" });
  });

  it("falls back to the oldest unfinished historical backlog before due-only reviews", () => {
    expect(selectNextTrainingTask({
      currentId: "a",
      todayKey: "2026-09-21",
      now: Date.parse("2026-09-21T12:00:00.000Z"),
      catalog,
      tasks: [
        { id: "d", date: "2026-09-20", status: "pending", sortOrder: 1, taskType: "new" },
        { id: "c", date: "2026-09-19", status: "in_progress", sortOrder: 2, taskType: "new" },
      ],
      states: [
        { id: "b", attemptCount: 1, nextReviewAt: "2026-09-18T00:00:00.000Z" },
      ],
    })).toEqual({ id: "c", source: "backlog", date: "2026-09-19", taskType: "new" });
  });

  it("uses the oldest due review after queues are clear", () => {
    expect(selectNextTrainingTask({
      currentId: "a",
      todayKey: "2026-09-21",
      now: Date.parse("2026-09-21T12:00:00.000Z"),
      catalog,
      tasks: [
        { id: "b", date: "2026-09-21", status: "completed", sortOrder: 2, taskType: "review" },
      ],
      states: [
        { id: "b", attemptCount: 1, nextReviewAt: "2026-09-20T00:00:00.000Z" },
        { id: "c", attemptCount: 2, nextReviewAt: "2026-09-19T00:00:00.000Z" },
      ],
    })).toEqual({ id: "c", source: "due", date: null, taskType: "review" });
  });

  it("while paused, exposes only reviews that were already overdue before the pause boundary", () => {
    const pauseStartedAt = Date.parse("2026-09-20T19:00:00.000Z");
    expect(selectNextTrainingTask({
      currentId: "a",
      todayKey: "2026-09-21",
      now: Date.parse("2026-09-21T12:00:00.000Z"),
      pauseStartedAt,
      catalog,
      tasks: [],
      states: [
        { id: "b", attemptCount: 1, nextReviewAt: "2026-09-20T18:59:59.000Z" },
        { id: "c", attemptCount: 1, nextReviewAt: "2026-09-20T19:00:00.000Z" },
        { id: "d", attemptCount: 1, nextReviewAt: "2026-09-21T00:00:00.000Z" },
      ],
    })).toEqual({ id: "b", source: "due", date: null, taskType: "review" });
  });

  it("returns null instead of repeating the completed current item", () => {
    expect(selectNextTrainingTask({
      currentId: "a",
      todayKey: "2026-09-21",
      now: Date.parse("2026-09-21T12:00:00.000Z"),
      catalog,
      tasks: [{ id: "a", date: "2026-09-21", status: "pending", sortOrder: 1, taskType: "new" }],
      states: [{ id: "a", attemptCount: 1, nextReviewAt: "2026-09-19T00:00:00.000Z" }],
    })).toBeNull();
  });
});

describe("nextTrainingTaskLabel", () => {
  it("uses a learning-specific label after Learn", () => {
    const todayNew = { id: "b", source: "today" as const, date: "2026-09-21", taskType: "new" };
    const todayReview = { id: "b", source: "today" as const, date: "2026-09-21", taskType: "review" };
    const backlog = { id: "b", source: "backlog" as const, date: "2026-09-20", taskType: "new" };
    const due = { id: "b", source: "due" as const, date: null, taskType: "review" };
    expect(nextTrainingTaskLabel(todayNew, true)).toBe("学习下一题");
    expect(nextTrainingTaskLabel(todayReview, true)).toBe("继续下一题");
    expect(nextTrainingTaskLabel(todayReview)).toBe("继续下一题");
    expect(nextTrainingTaskLabel(backlog)).toBe("继续补欠账");
    expect(nextTrainingTaskLabel(due)).toBe("继续到期复习");
  });
});
