import { describe, expect, it } from "vitest";

import {
  completeAlgorithmAttempt,
  type CompleteAlgorithmAttemptInput,
  type AlgorithmStatePayload,
} from "../lib/algorithm/attempts";
import {
  aggregateAlgorithmWeaknesses,
  generateDailyAlgorithmTasks,
  type AlgorithmPlannerProblem,
  type AlgorithmPlannerState,
  type AlgorithmWeaknessAttempt,
} from "../lib/planner/algorithm";

const problem = (
  id: string,
  orderIndex: number,
  tags: readonly string[] = [],
): AlgorithmPlannerProblem => ({
  id,
  tags,
  recommendedWeek: 1,
  importance: 3,
  orderIndex,
});

const problems = [
  problem("low", 1, ["pointer"]),
  problem("spaced", 2, ["pointer"]),
  problem("strong", 3, ["complexity"]),
];

function timestamp(day: number, minute: number) {
  return new Date(Date.UTC(2026, 0, day, 0, minute));
}

function plannerState(state: AlgorithmStatePayload): AlgorithmPlannerState {
  return {
    problemId: state.problemId,
    mastery: state.mastery,
    attemptCount: state.attemptCount,
    nextReviewAt: state.nextReviewAt,
  };
}

describe("seven-day algorithm acceptance simulation", () => {
  it("keeps the attempt, review, planner, evidence, and weakness loops deterministic", () => {
    const states = new Map<string, AlgorithmStatePayload>();
    const attempts: AlgorithmWeaknessAttempt[] = [];
    const selectedByDay = new Map<number, string[]>();

    const complete = (
      id: string,
      day: number,
      overrides: Partial<CompleteAlgorithmAttemptInput>,
    ) => {
      const result = completeAlgorithmAttempt({
        id: `${id}-attempt-${day}`,
        userId: "user-1",
        problemId: id,
        difficulty: "easy",
        startedAt: timestamp(day, 0),
        finishedAt: timestamp(day, 20),
        result: "first_ac",
        independence: "independent",
        waCount: 1,
        mistakeTags: [],
        previousState: states.get(id) ?? null,
        ...overrides,
      });
      states.set(id, result.state);
      attempts.push({ mistakeTags: result.attempt.mistakeTags });
      return result;
    };

    let dayOneLow: ReturnType<typeof complete>;
    let dayOneStrong: ReturnType<typeof complete>;
    let dayTwoFailure: ReturnType<typeof complete>;
    let dayFourSpacedAc: ReturnType<typeof complete>;

    for (let day = 1; day <= 7; day += 1) {
      const weaknessTags = aggregateAlgorithmWeaknesses({ attempts }).map(
        ({ tag }) => tag,
      );
      const first = generateDailyAlgorithmTasks({
        problems,
        states: [...states.values()].map(plannerState),
        weaknessTags,
        currentWeek: 1,
        newCount: day === 1 ? 3 : 0,
        reviewCount: day === 4 ? 2 : 1,
        today: timestamp(day, 12 * 60),
      });
      const second = generateDailyAlgorithmTasks({
        problems,
        states: [...states.values()].map(plannerState),
        weaknessTags,
        currentWeek: 1,
        newCount: day === 1 ? 3 : 0,
        reviewCount: day === 4 ? 2 : 1,
        today: timestamp(day, 12 * 60),
        existingTasks: first.map(({ problemId, taskType }) => ({
          problemId,
          taskType,
        })),
      });

      selectedByDay.set(
        day,
        first.map(({ problemId }) => problemId),
      );
      expect(second).toEqual([]);

      if (day === 1) {
        dayOneLow = complete("low", 1, {
          result: "first_ac",
          independence: "full_solution",
          mistakeTags: ["no_idea"],
        });
        complete("spaced", 1, {
          result: "first_ac",
          independence: "small_hint",
          mistakeTags: ["pointer"],
        });
        dayOneStrong = complete("strong", 1, {
          result: "first_ac",
          independence: "independent",
          mistakeTags: ["complexity"],
        });
      } else if (day === 2) {
        dayTwoFailure = complete("low", 2, {
          result: "failed",
          independence: "independent",
          difficulty: "hard",
          mistakeTags: ["boundary"],
        });
      } else if (day === 4) {
        dayFourSpacedAc = complete("spaced", 4, {
          result: "first_ac",
          independence: "independent",
          mistakeTags: ["pointer", "state"],
        });
      }
    }

    expect(dayOneLow!.state.mastery).toBe(30);
    expect(dayOneLow!.state.nextReviewAt).toBe("2026-01-02T00:20:00.000Z");
    expect(dayOneStrong!.state.mastery).toBe(85);
    expect(dayOneStrong!.state.nextReviewAt).toBe("2026-01-08T00:20:00.000Z");
    expect(dayOneLow!.state.mastery).not.toBe(dayOneStrong!.state.mastery);
    expect(selectedByDay.get(1)).toEqual(["low", "spaced", "strong"]);
    expect(selectedByDay.get(2)).toEqual(["low"]);
    expect(selectedByDay.get(4)).toEqual(["low", "spaced"]);
    expect(selectedByDay.size).toBe(7);

    expect(dayTwoFailure!.state.mastery).toBeLessThan(dayOneLow!.state.mastery);
    expect(dayTwoFailure!.state.mastery).toBe(15);
    expect(dayTwoFailure!.state.nextReviewAt).toBe("2026-01-03T00:20:00.000Z");

    expect(dayFourSpacedAc!.state.spacedIndependentAcAt).toBe(
      "2026-01-04T00:20:00.000Z",
    );
    expect(dayFourSpacedAc!.state.mastery).toBe(81.2);
    expect(dayFourSpacedAc!.state.status).toBe("learning");

    attempts.push({ aiWeaknessTags: ["recall"] });
    const dayOneWeaknesses = aggregateAlgorithmWeaknesses({
      attempts: attempts.slice(0, 3),
    });
    const daySevenWeaknesses = aggregateAlgorithmWeaknesses({ attempts });
    expect(dayOneWeaknesses).toContainEqual({ tag: "pointer", count: 1 });
    expect(daySevenWeaknesses).toContainEqual({ tag: "pointer", count: 2 });
    expect(daySevenWeaknesses).not.toEqual(dayOneWeaknesses);

    expect(states.get("low")).toMatchObject({
      mastery: 15,
      attemptCount: 2,
      status: "learning",
    });
    expect(states.get("spaced")).toMatchObject({
      mastery: 81.2,
      attemptCount: 2,
      status: "learning",
      spacedIndependentAcAt: "2026-01-04T00:20:00.000Z",
    });
    expect(states.get("strong")).toMatchObject({
      mastery: 85,
      attemptCount: 1,
      status: "learning",
    });
  });

  it("prioritizes lower mastery, then the longest-overdue equal mastery", () => {
    const result = generateDailyAlgorithmTasks({
      problems: [
        problem("same-old", 2),
        problem("lower", 3),
        problem("same-new", 1),
      ],
      states: [
        {
          problemId: "same-old",
          mastery: 40,
          attemptCount: 1,
          nextReviewAt: "2026-01-01T00:00:00.000Z",
        },
        {
          problemId: "lower",
          mastery: 20,
          attemptCount: 1,
          nextReviewAt: "2026-01-05T00:00:00.000Z",
        },
        {
          problemId: "same-new",
          mastery: 40,
          attemptCount: 1,
          nextReviewAt: "2026-01-04T00:00:00.000Z",
        },
      ],
      currentWeek: 1,
      newCount: 0,
      reviewCount: 3,
      today: "2026-01-10T00:00:00.000Z",
    });

    expect(result.map(({ problemId }) => problemId)).toEqual([
      "lower",
      "same-old",
      "same-new",
    ]);
  });
});
