import { describe, expect, it } from "vitest";

import { generateDailyTasks } from "../lib/planner/daily";
import {
  generateDailyKnowledgeTasks,
  type KnowledgePlannerQuestion,
  type KnowledgePlannerState,
} from "../lib/planner/knowledge";

const today = new Date("2026-09-09T08:00:00.000Z");

const question = (
  id: string,
  overrides: Partial<KnowledgePlannerQuestion> = {},
): KnowledgePlannerQuestion => ({
  id,
  questionType: "main",
  isCore6Weeks: true,
  recommendedWeek: 1,
  importance: 3,
  sourceOrder: Number(id.replace(/\D/g, "")) || 0,
  ...overrides,
});

const state = (
  questionId: string,
  overrides: Partial<KnowledgePlannerState> = {},
): KnowledgePlannerState => ({
  questionId,
  mastery: 50,
  attemptCount: 1,
  nextReviewAt: "2026-09-08T08:00:00.000Z",
  ...overrides,
});

describe("generateDailyKnowledgeTasks", () => {
  it("returns three overdue reviews before three current-week core main questions", () => {
    const questions = [
      question("r1"),
      question("r2"),
      question("r3"),
      question("n1", { importance: 5 }),
      question("n2", { importance: 4 }),
      question("n3", { importance: 3 }),
      question("follow", { questionType: "follow_up", importance: 5 }),
      question("non-core", { isCore6Weeks: false, importance: 5 }),
    ];
    const states = [state("r1"), state("r2"), state("r3")];
    const tasks = generateDailyKnowledgeTasks({ questions, states, currentWeek: 1, today });

    expect(tasks.map(({ questionId, taskType }) => [questionId, taskType])).toEqual([
      ["r1", "review"],
      ["r2", "review"],
      ["r3", "review"],
      ["n1", "new"],
      ["n2", "new"],
      ["n3", "new"],
    ]);
  });

  it("prioritizes more overdue review, then core, low mastery and importance", () => {
    const questions = [
      question("old-follow", { questionType: "follow_up", isCore6Weeks: false }),
      question("core-low"),
      question("core-high", { importance: 5 }),
      question("follow-low", { questionType: "follow_up", isCore6Weeks: false }),
    ];
    const states = [
      state("old-follow", { nextReviewAt: "2026-09-01T08:00:00.000Z", mastery: 90 }),
      state("core-low", { mastery: 20 }),
      state("core-high", { mastery: 50 }),
      state("follow-low", { mastery: 10 }),
    ];

    expect(generateDailyKnowledgeTasks({
      questions,
      states,
      currentWeek: 1,
      reviewCount: 4,
      newCount: 0,
      today,
    }).map(({ questionId }) => questionId)).toEqual([
      "old-follow",
      "core-low",
      "core-high",
      "follow-low",
    ]);
  });

  it("selects current week before unfinished earlier core questions", () => {
    const tasks = generateDailyKnowledgeTasks({
      questions: [
        question("week1", { recommendedWeek: 1, importance: 5 }),
        question("week2", { recommendedWeek: 2, importance: 2 }),
      ],
      states: [],
      currentWeek: 2,
      newCount: 1,
      reviewCount: 0,
      today,
    });
    expect(tasks[0].questionId).toBe("week2");
  });

  it("uses 5 review + 1 new in week 5 and review-only in week 6", () => {
    const questions = [
      ...Array.from({ length: 6 }, (_, index) => question(`r${index}`)),
      ...Array.from({ length: 3 }, (_, index) => question(`n${index}`, { recommendedWeek: 4 })),
    ];
    const states = Array.from({ length: 6 }, (_, index) => state(`r${index}`));

    const week5 = generateDailyKnowledgeTasks({ questions, states, currentWeek: 5, today });
    expect(week5.filter(({ taskType }) => taskType === "review")).toHaveLength(6);
    expect(week5.filter(({ taskType }) => taskType === "new")).toHaveLength(1);

    const week6 = generateDailyKnowledgeTasks({ questions, states, currentWeek: 6, today });
    expect(week6).toHaveLength(6);
    expect(week6.every(({ taskType }) => taskType === "review")).toBe(true);
  });

  it("counts existing tasks against quotas and is idempotent", () => {
    const questions = [question("r1"), question("r2"), question("n1"), question("n2")];
    const states = [state("r1"), state("r2")];
    const first = generateDailyKnowledgeTasks({
      questions,
      states,
      currentWeek: 1,
      newCount: 2,
      reviewCount: 2,
      today,
    });
    const second = generateDailyKnowledgeTasks({
      questions,
      states,
      existingTasks: first,
      currentWeek: 1,
      newCount: 2,
      reviewCount: 2,
      today,
    });
    expect(first).toHaveLength(4);
    expect(second).toEqual([]);
  });

  it("does not fill review quota with not-due or unlearned questions", () => {
    const tasks = generateDailyKnowledgeTasks({
      questions: [question("future"), question("unlearned")],
      states: [
        state("future", { nextReviewAt: "2026-09-10T08:00:00.000Z" }),
        state("unlearned", { attemptCount: 0, nextReviewAt: "2026-09-01T08:00:00.000Z" }),
      ],
      currentWeek: 1,
      newCount: 0,
      reviewCount: 3,
      today,
    });
    expect(tasks).toEqual([]);
  });

  it("keeps inputs unchanged and rejects invalid duplicate data", () => {
    const questions = [question("q1")];
    const states: KnowledgePlannerState[] = [];
    const snapshot = JSON.stringify({ questions, states });
    generateDailyKnowledgeTasks({ questions, states, currentWeek: 1, today });
    expect(JSON.stringify({ questions, states })).toBe(snapshot);
    expect(() => generateDailyKnowledgeTasks({
      questions: [question("q1"), question("q1")],
      states,
      currentWeek: 1,
      today,
    })).toThrow(/duplicate question id/);
  });
});

describe("generateDailyKnowledgeTasks overdue review uplift", () => {
  it("uplifts the review quota to three times the configured amount when backlog exists", () => {
    const questions = [
      question("r1", { sourceOrder: 1 }),
      question("r2", { sourceOrder: 2 }),
      question("r3", { sourceOrder: 3 }),
    ];
    const states = [
      state("r1", { nextReviewAt: "2026-09-06T08:00:00.000Z" }),
      state("r2", { nextReviewAt: "2026-09-07T08:00:00.000Z" }),
      state("r3", { nextReviewAt: "2026-09-08T08:00:00.000Z" }),
    ];
    const tasks = generateDailyKnowledgeTasks({
      questions,
      states,
      currentWeek: 1,
      newCount: 0,
      reviewCount: 1,
      today,
    });

    expect(tasks.map(({ questionId, taskType }) => [questionId, taskType])).toEqual([
      ["r1", "review"],
      ["r2", "review"],
      ["r3", "review"],
    ]);
  });

  it("caps the uplift at the actual overdue count and keeps new quota unchanged", () => {
    const questions = [
      question("r1", { sourceOrder: 1 }),
      question("r2", { sourceOrder: 2 }),
      question("n1", { importance: 5 }),
    ];
    const states = [
      state("r1", { nextReviewAt: "2026-09-06T08:00:00.000Z" }),
      state("r2", { nextReviewAt: "2026-09-07T08:00:00.000Z" }),
    ];
    const tasks = generateDailyKnowledgeTasks({
      questions,
      states,
      currentWeek: 1,
      newCount: 1,
      reviewCount: 1,
      today,
    });

    expect(tasks.map(({ questionId, taskType }) => [questionId, taskType])).toEqual([
      ["r1", "review"],
      ["r2", "review"],
      ["n1", "new"],
    ]);
  });

  it("never uplifts an explicitly configured zero review quota", () => {
    const questions = [
      question("r1", { sourceOrder: 1 }),
      question("r2", { sourceOrder: 2 }),
      question("r3", { sourceOrder: 3 }),
    ];
    const states = [
      state("r1", { nextReviewAt: "2026-09-06T08:00:00.000Z" }),
      state("r2", { nextReviewAt: "2026-09-07T08:00:00.000Z" }),
      state("r3", { nextReviewAt: "2026-09-08T08:00:00.000Z" }),
    ];
    const tasks = generateDailyKnowledgeTasks({
      questions,
      states,
      currentWeek: 1,
      newCount: 0,
      reviewCount: 0,
      today,
    });

    expect(tasks).toEqual([]);
  });
});

describe("generateDailyTasks", () => {
  it("composes algorithm and knowledge planners without changing their rules", () => {
    const result = generateDailyTasks({
      algorithm: {
        problems: [{ id: "a1", tags: [], recommendedWeek: 1, importance: 3, orderIndex: 1 }],
        states: [],
        currentWeek: 1,
        newCount: 1,
        reviewCount: 0,
        today,
      },
      knowledge: {
        questions: [question("k1")],
        states: [],
        currentWeek: 1,
        newCount: 1,
        reviewCount: 0,
        today,
      },
    });
    expect(result.algorithmTasks.map(({ problemId }) => problemId)).toEqual(["a1"]);
    expect(result.knowledgeTasks.map(({ questionId }) => questionId)).toEqual(["k1"]);
  });
});
