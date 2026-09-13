import { describe, expect, it } from "vitest";

import {
  calculateCatalogProgress,
  calculateCyclePosition,
  calculateTrainingBacklog,
  calculateTrainingStreak,
  calculateWeightedMastery,
  calculateWeeklyCompletion,
} from "../lib/progress/summary";
import { generateDailyAlgorithmTasks } from "../lib/planner/algorithm";
import { generateDailyKnowledgeTasks } from "../lib/planner/knowledge";

describe("progress summary", () => {
  it.each([
    ["2026-09-09T12:00:00+08:00", 1, 1, false, 2],
    ["2026-10-20T12:00:00+08:00", 42, 6, false, 100],
    ["2026-10-21T12:00:00+08:00", 43, 6, true, 100],
  ])("calculates the first-cycle boundary for %s", (today, day, week, complete, progress) => {
    expect(calculateCyclePosition("2026-09-09", today)).toEqual({
      day,
      week,
      isFirstCycleComplete: complete,
      progress,
    });
  });

  it("calculates the current generated-task completion rate", () => {
    expect(calculateWeeklyCompletion({
      planStartDate: "2026-09-09",
      today: "2026-09-12T12:00:00+08:00",
      tasks: [
        { date: "2026-09-09", status: "completed" },
        { date: "2026-09-10", status: "completed" },
        { date: "2026-09-11", status: "pending" },
        { date: "2026-09-16", status: "completed" },
      ],
    })).toEqual({ completed: 2, total: 3, percentage: 67 });
  });

  it("keeps a streak through yesterday when today is not complete", () => {
    const tasks = [
      { date: "2026-09-08", status: "completed" as const },
      { date: "2026-09-09", status: "completed" as const },
      { date: "2026-09-10", status: "pending" as const },
    ];
    expect(calculateTrainingStreak(tasks, "2026-09-10T12:00:00+08:00")).toBe(2);
  });

  it("does not bridge a missed day", () => {
    const tasks = [
      { date: "2026-09-07", status: "completed" as const },
      { date: "2026-09-09", status: "completed" as const },
    ];
    expect(calculateTrainingStreak(tasks, "2026-09-09T12:00:00+08:00")).toBe(1);
  });

  it("summarizes learned, mastered, due, and unlearned catalog items", () => {
    expect(calculateCatalogProgress(["new", "due", "mastered"], {
      due: {
        attemptCount: 1,
        mastery: 40,
        nextReviewAt: "2026-09-09T00:00:00.000Z",
        status: "learning",
      },
      mastered: {
        attemptCount: 2,
        mastery: 90,
        nextReviewAt: "2026-09-09T00:00:00.000Z",
        status: "mastered",
      },
    }, "2026-09-10T00:00:00.000Z")).toEqual({
      total: 3,
      learned: 2,
      mastered: 1,
      due: 1,
      unlearned: 1,
      completion: 67,
    });
  });

  it("uses item weights and treats missing states as zero mastery", () => {
    expect(calculateWeightedMastery([
      { id: "important", weight: 3 },
      { id: "new", weight: 1 },
    ], {
      important: { mastery: 80 },
    })).toBe(60);
  });

  it("keeps generating due reviews on Day 43 without forcing new items", () => {
    const today = "2026-10-21T04:00:00.000Z";
    const week = calculateCyclePosition("2026-09-09", today).week;
    const algorithmTasks = generateDailyAlgorithmTasks({
      problems: [
        { id: "due", tags: [], recommendedWeek: 1, importance: 5, orderIndex: 1 },
        { id: "new", tags: [], recommendedWeek: 1, importance: 4, orderIndex: 2 },
      ],
      states: [{ problemId: "due", mastery: 70, attemptCount: 1, nextReviewAt: "2026-10-20T00:00:00.000Z" }],
      currentWeek: week,
      newCount: 1,
      reviewCount: 1,
      today,
    });
    const knowledgeTasks = generateDailyKnowledgeTasks({
      questions: [
        { id: "due", questionType: "main", isCore6Weeks: true, recommendedWeek: 1, importance: 5, sourceOrder: 1 },
        { id: "new", questionType: "main", isCore6Weeks: true, recommendedWeek: 1, importance: 4, sourceOrder: 2 },
      ],
      states: [{ questionId: "due", mastery: 70, attemptCount: 1, nextReviewAt: "2026-10-20T00:00:00.000Z" }],
      currentWeek: week,
      newCount: 1,
      reviewCount: 1,
      today,
    });

    expect(algorithmTasks.map((task) => [task.problemId, task.taskType])).toEqual([["due", "review"]]);
    expect(knowledgeTasks.map((task) => [task.questionId, task.taskType])).toEqual([["due", "review"]]);
  });
});

describe("calculateTrainingBacklog", () => {
  const now = "2026-09-13T12:00:00+08:00";

  it("counts overdue reviews from states and leftover tasks from earlier dates", () => {
    expect(calculateTrainingBacklog({
      algorithmStates: [
        { attemptCount: 1, nextReviewAt: "2026-09-12T00:00:00.000Z" },
        { attemptCount: 1, nextReviewAt: "2026-09-14T00:00:00.000Z" },
        { attemptCount: 0, nextReviewAt: "2026-09-01T00:00:00.000Z" },
        { attemptCount: 2, nextReviewAt: null },
      ],
      knowledgeStates: [
        { attemptCount: 1, nextReviewAt: "2026-09-10T00:00:00.000Z" },
        { attemptCount: 1, nextReviewAt: "2026-09-20T00:00:00.000Z" },
      ],
      algorithmDailyTasks: {
        "2026-09-12": [{ date: "2026-09-12", status: "completed" }],
        "2026-09-13": [{ date: "2026-09-13", status: "pending" }],
      },
      knowledgeDailyTasks: {
        "2026-09-12": [
          { date: "2026-09-12", status: "pending" },
          { date: "2026-09-12", status: "completed" },
        ],
      },
      today: now,
    })).toEqual({
      algorithmOverdueReviews: 1,
      knowledgeOverdueReviews: 1,
      algorithmLeftoverTasks: 0,
      knowledgeLeftoverTasks: 1,
    });
  });

  it("treats in_progress earlier tasks as leftover but ignores today's tasks", () => {
    expect(calculateTrainingBacklog({
      algorithmStates: [],
      knowledgeStates: [],
      algorithmDailyTasks: {
        "2026-09-12": [{ date: "2026-09-12", status: "in_progress" }],
        "2026-09-13": [
          { date: "2026-09-13", status: "pending" },
          { date: "2026-09-13", status: "in_progress" },
        ],
      },
      knowledgeDailyTasks: {},
      today: now,
    })).toEqual({
      algorithmOverdueReviews: 0,
      knowledgeOverdueReviews: 0,
      algorithmLeftoverTasks: 1,
      knowledgeLeftoverTasks: 0,
    });
  });

  it("returns zeros when everything is complete and no reviews are due", () => {
    expect(calculateTrainingBacklog({
      algorithmStates: [{ attemptCount: 3, nextReviewAt: "2026-09-20T00:00:00.000Z" }],
      knowledgeStates: [{ attemptCount: 3, nextReviewAt: "2026-09-20T00:00:00.000Z" }],
      algorithmDailyTasks: {
        "2026-09-12": [{ date: "2026-09-12", status: "completed" }],
      },
      knowledgeDailyTasks: {},
      today: now,
    })).toEqual({
      algorithmOverdueReviews: 0,
      knowledgeOverdueReviews: 0,
      algorithmLeftoverTasks: 0,
      knowledgeLeftoverTasks: 0,
    });
  });

  it("rejects an invalid today input", () => {
    expect(() =>
      calculateTrainingBacklog({
        algorithmStates: [],
        knowledgeStates: [],
        algorithmDailyTasks: {},
        knowledgeDailyTasks: {},
        today: "not-a-date",
      }),
    ).toThrowError(RangeError);
  });
});
