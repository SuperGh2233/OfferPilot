import { describe, expect, it } from "vitest";

import {
  aggregateAlgorithmWeaknesses,
  generateDailyAlgorithmTasks,
  type AlgorithmPlannerProblem,
  type AlgorithmPlannerState,
  type GenerateDailyAlgorithmTasksInput,
} from "../lib/planner/algorithm";

const today = "2026-01-10T00:00:00.000Z";

function problem(
  id: string,
  overrides: Partial<AlgorithmPlannerProblem> = {},
): AlgorithmPlannerProblem {
  return {
    id,
    tags: [],
    recommendedWeek: 1,
    importance: 3,
    orderIndex: 1,
    ...overrides,
  };
}

function state(
  problemId: string,
  overrides: Partial<AlgorithmPlannerState> = {},
): AlgorithmPlannerState {
  return {
    problemId,
    mastery: 50,
    attemptCount: 1,
    nextReviewAt: null,
    ...overrides,
  };
}

function plannerInput(
  overrides: Partial<GenerateDailyAlgorithmTasksInput> = {},
): GenerateDailyAlgorithmTasksInput {
  return {
    problems: [],
    states: [],
    currentWeek: 1,
    today,
    ...overrides,
  };
}

describe("generateDailyAlgorithmTasks", () => {
  it("uses the default one-review plus two-new quota", () => {
    expect(
      generateDailyAlgorithmTasks(
        plannerInput({
          problems: [
            problem("review", { orderIndex: 3 }),
            problem("new-1", { orderIndex: 1 }),
            problem("new-2", { orderIndex: 2 }),
            problem("new-3", { orderIndex: 4 }),
          ],
          states: [
            state("review", {
              mastery: 30,
              nextReviewAt: "2026-01-09T00:00:00.000Z",
            }),
          ],
        }),
      ),
    ).toEqual([
      { problemId: "review", taskType: "review", reason: "review_due", sortOrder: 0 },
      { problemId: "new-1", taskType: "new", reason: "week_1_new", sortOrder: 1 },
      { problemId: "new-2", taskType: "new", reason: "week_1_new", sortOrder: 2 },
    ]);
  });

  it("sorts due reviews by mastery, oldest review date, then order index", () => {
    const result = generateDailyAlgorithmTasks(
      plannerInput({
        problems: [
          problem("same-date-late", { orderIndex: 9 }),
          problem("low-old", { orderIndex: 8 }),
          problem("same-date-early", { orderIndex: 2 }),
          problem("low-new", { orderIndex: 1 }),
        ],
        states: [
          state("same-date-late", {
            mastery: 50,
            nextReviewAt: "2026-01-05T00:00:00.000Z",
          }),
          state("low-old", {
            mastery: 20,
            nextReviewAt: "2026-01-01T00:00:00.000Z",
          }),
          state("same-date-early", {
            mastery: 50,
            nextReviewAt: "2026-01-05T00:00:00.000Z",
          }),
          state("low-new", {
            mastery: 20,
            nextReviewAt: "2026-01-08T00:00:00.000Z",
          }),
        ],
        newCount: 0,
        reviewCount: 4,
      }),
    );

    expect(result.map(({ problemId }) => problemId)).toEqual([
      "low-old",
      "low-new",
      "same-date-early",
      "same-date-late",
    ]);
  });

  it("prioritizes exact weakness tags, then current week, importance, and order", () => {
    const result = generateDailyAlgorithmTasks(
      plannerInput({
        currentWeek: 2,
        weaknessTags: [" pointer "],
        newCount: 4,
        reviewCount: 0,
        problems: [
          problem("other-week", {
            recommendedWeek: 1,
            importance: 5,
            orderIndex: 0,
          }),
          problem("weakness", {
            tags: [" pointer "],
            recommendedWeek: 1,
            importance: 1,
            orderIndex: 9,
          }),
          problem("current-late", {
            recommendedWeek: 2,
            importance: 5,
            orderIndex: 8,
          }),
          problem("current-early", {
            recommendedWeek: 2,
            importance: 5,
            orderIndex: 2,
          }),
        ],
      }),
    );

    expect(result).toEqual([
      {
        problemId: "weakness",
        taskType: "weakness",
        reason: "weakness_related",
        sortOrder: 0,
      },
      {
        problemId: "current-early",
        taskType: "new",
        reason: "week_2_new",
        sortOrder: 1,
      },
      {
        problemId: "current-late",
        taskType: "new",
        reason: "week_2_new",
        sortOrder: 2,
      },
      {
        problemId: "other-week",
        taskType: "new",
        reason: "week_2_new",
        sortOrder: 3,
      },
    ]);
  });

  it("counts existing review and new/weakness tasks against their quotas", () => {
    const result = generateDailyAlgorithmTasks(
      plannerInput({
        problems: [
          problem("review", { orderIndex: 1 }),
          problem("existing-new", { orderIndex: 2 }),
          problem("next-new", { orderIndex: 3 }),
        ],
        states: [
          state("review", {
            nextReviewAt: "2026-01-01T00:00:00.000Z",
          }),
        ],
        existingTasks: [
          { problemId: "review", taskType: "review" },
          { problemId: "existing-new", taskType: "weakness" },
        ],
      }),
    );

    expect(result).toEqual([
      {
        problemId: "next-new",
        taskType: "new",
        reason: "week_1_new",
        sortOrder: 2,
      },
    ]);
  });

  it("is idempotent when the complete first result is passed back as existingTasks", () => {
    const input = plannerInput({
      problems: [
        problem("review", { orderIndex: 1 }),
        problem("new-1", { orderIndex: 2 }),
        problem("new-2", { orderIndex: 3 }),
      ],
      states: [
        state("review", {
          nextReviewAt: "2026-01-01T00:00:00.000Z",
        }),
      ],
    });
    const first = generateDailyAlgorithmTasks(input);
    const second = generateDailyAlgorithmTasks({
      ...input,
      existingTasks: first.map(({ problemId, taskType }) => ({ problemId, taskType })),
    });

    expect(second).toEqual([]);
  });

  it.each([
    [4, ["review", "review", "review", "new"]],
    [5, ["review", "review", "review", "new"]],
    [6, ["review", "review", "review"]],
  ] as const)("uses the Week %d review/new distribution", (currentWeek, taskTypes) => {
    const result = generateDailyAlgorithmTasks(
      plannerInput({
        currentWeek,
        problems: [
          problem("review-1", { orderIndex: 1 }),
          problem("review-2", { orderIndex: 2 }),
          problem("review-3", { orderIndex: 3 }),
          problem("new-1", { orderIndex: 4 }),
          problem("new-2", { orderIndex: 5 }),
        ],
        states: [
          state("review-1", { nextReviewAt: "2026-01-01T00:00:00.000Z" }),
          state("review-2", { nextReviewAt: "2026-01-02T00:00:00.000Z" }),
          state("review-3", { nextReviewAt: "2026-01-03T00:00:00.000Z" }),
        ],
      }),
    );

    expect(result.map(({ taskType }) => taskType)).toEqual(taskTypes);
  });

  it("does not fill a missing review quota with a not-yet-due review", () => {
    const result = generateDailyAlgorithmTasks(
      plannerInput({
        currentWeek: 4,
        problems: [
          problem("due", { orderIndex: 1 }),
          problem("not-due", { orderIndex: 2 }),
          problem("new", { orderIndex: 3 }),
        ],
        states: [
          state("due", { nextReviewAt: "2026-01-09T00:00:00.000Z" }),
          state("not-due", { nextReviewAt: "2026-01-11T00:00:00.000Z" }),
        ],
      }),
    );

    expect(result.map(({ problemId }) => problemId)).toEqual(["due", "new"]);
  });

  it("does not mutate planner inputs", () => {
    const input = plannerInput({
      currentWeek: 2,
      weaknessTags: ["pointer"],
      problems: [
        problem("new", { tags: [" pointer "], orderIndex: 2 }),
        problem("review", { orderIndex: 1 }),
      ],
      states: [state("review", { nextReviewAt: "2026-01-01T00:00:00.000Z" })],
      existingTasks: [],
    });
    const before = JSON.stringify(input);

    generateDailyAlgorithmTasks(input);

    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("aggregateAlgorithmWeaknesses", () => {
  it("deduplicates each attempt, drops blank tags, sorts stably, and honors limit", () => {
    const attempts = [
      {
        mistakeTags: [" Pointer ", "state", ""],
        aiWeaknessTags: ["pointer", " complexity "],
      },
      {
        mistakeTags: ["state", "state"],
        aiWeaknessTags: [" pointer "],
      },
      { mistakeTags: ["  "], aiWeaknessTags: [] },
      { mistakeTags: ["complexity"], aiWeaknessTags: ["state"] },
    ];
    const before = JSON.stringify(attempts);

    expect(aggregateAlgorithmWeaknesses({ attempts })).toEqual([
      { tag: "state", count: 3 },
      { tag: "complexity", count: 2 },
      { tag: "pointer", count: 2 },
    ]);
    expect(aggregateAlgorithmWeaknesses({ attempts, limit: 2 })).toEqual([
      { tag: "state", count: 3 },
      { tag: "complexity", count: 2 },
    ]);
    expect(JSON.stringify(attempts)).toBe(before);
  });
});

describe("generateDailyAlgorithmTasks validation", () => {
  const validInput = plannerInput({
    problems: [problem("p")],
    states: [],
  });

  it.each([
    ["week 0", { currentWeek: 0 }],
    ["week 7", { currentWeek: 7 }],
    ["fractional week", { currentWeek: 1.5 }],
    ["invalid today", { today: "not-a-date" }],
    ["negative new quota", { newCount: -1 }],
    ["fractional review quota", { reviewCount: 1.5 }],
    ["mastery above 100", { states: [state("p", { mastery: 101 })] }],
    ["negative attempt count", { states: [state("p", { attemptCount: -1 })] }],
    ["invalid review date", { states: [state("p", { nextReviewAt: "not-a-date" })] }],
  ])("rejects %s", (_name, overrides) => {
    expect(() =>
      generateDailyAlgorithmTasks({
        ...validInput,
        ...overrides,
      }),
    ).toThrowError(RangeError);
  });
});

describe("generateDailyAlgorithmTasks overdue review uplift", () => {
  const overdueProblem = (id: string, day: number) =>
    problem(id, { orderIndex: day });
  const overdueState = (id: string, day: number) =>
    state(id, {
      mastery: 50,
      nextReviewAt: new Date(Date.parse("2026-01-10T00:00:00.000Z") - day * 86_400_000)
        .toISOString(),
    });

  it("uplifts the review quota to three times the configured amount when backlog exists", () => {
    const result = generateDailyAlgorithmTasks(
      plannerInput({
        problems: [overdueProblem("r1", 1), overdueProblem("r2", 2), overdueProblem("r3", 3)],
        states: [overdueState("r1", 1), overdueState("r2", 2), overdueState("r3", 3)],
        reviewCount: 1,
        newCount: 0,
      }),
    );

    expect(result.map(({ problemId, taskType }) => [problemId, taskType])).toEqual([
      ["r3", "review"],
      ["r2", "review"],
      ["r1", "review"],
    ]);
  });

  it("caps the uplift at the actual overdue count", () => {
    const result = generateDailyAlgorithmTasks(
      plannerInput({
        problems: [overdueProblem("r1", 1), overdueProblem("r2", 2)],
        states: [overdueState("r1", 1), overdueState("r2", 2)],
        reviewCount: 1,
        newCount: 0,
      }),
    );

    expect(result).toHaveLength(2);
    expect(result.every(({ taskType }) => taskType === "review")).toBe(true);
  });

  it("never uplifts an explicitly configured zero review quota", () => {
    const result = generateDailyAlgorithmTasks(
      plannerInput({
        problems: [overdueProblem("r1", 1), overdueProblem("r2", 2), overdueProblem("r3", 3)],
        states: [overdueState("r1", 1), overdueState("r2", 2), overdueState("r3", 3)],
        reviewCount: 0,
        newCount: 0,
      }),
    );

    expect(result).toEqual([]);
  });

  it("keeps new-task quota unchanged while uplifting reviews", () => {
    const result = generateDailyAlgorithmTasks(
      plannerInput({
        problems: [
          overdueProblem("r1", 1),
          overdueProblem("r2", 2),
          overdueProblem("r3", 3),
          problem("new-1", { orderIndex: 10 }),
        ],
        states: [overdueState("r1", 1), overdueState("r2", 2), overdueState("r3", 3)],
        reviewCount: 1,
        newCount: 1,
      }),
    );

    expect(result.map(({ taskType }) => taskType)).toEqual(["review", "review", "review", "new"]);
  });

  it("does not add reviews once today's quota is already scheduled", () => {
    const result = generateDailyAlgorithmTasks(
      plannerInput({
        problems: [overdueProblem("r1", 1), overdueProblem("r2", 2), overdueProblem("r3", 3)],
        states: [overdueState("r1", 1), overdueState("r2", 2), overdueState("r3", 3)],
        existingTasks: [{ problemId: "r3", taskType: "review" }],
        reviewCount: 1,
        newCount: 0,
      }),
    );

    expect(result).toEqual([]);
  });
});
