import { describe, expect, it } from "vitest";

import {
  completeAlgorithmAttempt,
  startAlgorithmAttempt,
  type CompleteAlgorithmAttemptInput,
  type PreviousAlgorithmState,
} from "../lib/algorithm/attempts";
import type {
  AlgorithmIndependence,
  AlgorithmResult,
} from "../lib/mastery/algorithm";

const startedAt = new Date("2026-01-01T00:00:00.000Z");
const finishedAt = new Date("2026-01-01T00:20:00.250Z");

const previousState = (
  overrides: Partial<PreviousAlgorithmState> = {},
): PreviousAlgorithmState => ({
  userId: "user-1",
  problemId: "problem-1",
  mastery: 60,
  attemptCount: 1,
  lastAttemptAt: "2025-12-29T00:00:00.000Z",
  nextReviewAt: "2026-01-01T00:00:00.000Z",
  status: "learning",
  lastResult: "first_ac",
  independentAcCount: 0,
  lastIndependentAcAt: null,
  spacedIndependentAcAt: null,
  ...overrides,
});

const completeInput = (
  overrides: Partial<CompleteAlgorithmAttemptInput> = {},
): CompleteAlgorithmAttemptInput => ({
  id: "attempt-1",
  userId: "user-1",
  problemId: "problem-1",
  difficulty: "easy",
  startedAt,
  finishedAt,
  result: "first_ac",
  independence: "independent",
  waCount: 1,
  mistakeTags: ["boundary"],
  code: "return answer;",
  previousState: null,
  ...overrides,
});

describe("startAlgorithmAttempt", () => {
  it("returns an unfinished attempt with caller-owned identity and time", () => {
    const sourceDate = new Date(startedAt.getTime());
    const result = startAlgorithmAttempt({
      id: "attempt-1",
      userId: "user-1",
      problemId: "problem-1",
      startedAt: sourceDate,
    });

    expect(result).toEqual({
      id: "attempt-1",
      userId: "user-1",
      problemId: "problem-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: null,
      durationSeconds: null,
      result: null,
      independence: null,
      waCount: 0,
      mistakeTags: [],
      code: null,
      aiAnalysis: null,
      attemptScore: null,
      masteryBefore: null,
      masteryAfter: null,
    });
    expect(sourceDate.getTime()).toBe(startedAt.getTime());
  });
});

describe("completeAlgorithmAttempt", () => {
  it("completes a first attempt and creates learning state", () => {
    const result = completeAlgorithmAttempt(completeInput());

    expect(result.attempt).toMatchObject({
      id: "attempt-1",
      userId: "user-1",
      problemId: "problem-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:20:00.250Z",
      durationSeconds: 1200,
      result: "first_ac",
      independence: "independent",
      waCount: 1,
      mistakeTags: ["boundary"],
      code: "return answer;",
      attemptScore: 85,
      masteryBefore: null,
      masteryAfter: 85,
    });
    expect(result.state).toEqual({
      userId: "user-1",
      problemId: "problem-1",
      mastery: 85,
      attemptCount: 1,
      lastAttemptAt: "2026-01-01T00:20:00.250Z",
      nextReviewAt: "2026-01-08T00:20:00.250Z",
      status: "learning",
      lastResult: "first_ac",
      independentAcCount: 1,
      lastIndependentAcAt: "2026-01-01T00:20:00.250Z",
      spacedIndependentAcAt: null,
    });
  });

  it("uses the previous state for a smooth second-attempt update", () => {
    const result = completeAlgorithmAttempt(
      completeInput({
        finishedAt: new Date("2026-01-01T00:20:00.250Z"),
        previousState: previousState(),
      }),
    );

    expect(result.attempt.masteryBefore).toBe(60);
    expect(result.attempt.masteryAfter).toBe(78);
    expect(result.state.attemptCount).toBe(2);
    expect(result.state.nextReviewAt).toBe("2026-01-06T00:20:00.250Z");
  });

  const evidenceCases: [
    string,
    { result: AlgorithmResult; independence: AlgorithmIndependence },
    number,
    string | null,
  ][] = [
    [
      "independent AC after three days",
      { result: "first_ac", independence: "independent" },
      1,
      "2026-01-01T00:20:00.250Z",
    ],
    [
      "non-independent AC",
      { result: "first_ac", independence: "small_hint" },
      0,
      null,
    ],
    [
      "failed attempt",
      { result: "failed", independence: "independent" },
      0,
      null,
    ],
  ];

  it.each(evidenceCases)(
    "tracks independent evidence for %s",
    (_name, feedback, expectedIndependentCount, expectedSpacedAt) => {
      const result = completeAlgorithmAttempt(
        completeInput({
          result: feedback.result,
          independence: feedback.independence,
          previousState: previousState(),
        }),
      );

      expect(result.state.independentAcCount).toBe(expectedIndependentCount);
      expect(result.state.spacedIndependentAcAt).toBe(expectedSpacedAt);
    },
  );

  it("marks a state mastered only after spaced independent evidence", () => {
    const result = completeAlgorithmAttempt(
      completeInput({
        previousState: previousState({
          mastery: 90,
          lastAttemptAt: "2025-12-29T00:20:00.250Z",
        }),
      }),
    );

    expect(result.state.mastery).toBe(90);
    expect(result.state.attemptCount).toBe(2);
    expect(result.state.spacedIndependentAcAt).toBe(
      "2026-01-01T00:20:00.250Z",
    );
    expect(result.state.status).toBe("mastered");
  });

  it("floors duration to whole seconds and preserves input values", () => {
    const tags = ["java_api", "careless"] as const;
    const inputStartedAt = new Date("2026-01-01T00:00:00.001Z");
    const inputFinishedAt = new Date("2026-01-01T00:00:02.999Z");
    const input = completeInput({
      startedAt: inputStartedAt,
      finishedAt: inputFinishedAt,
      result: "failed",
      independence: "full_solution",
      mistakeTags: tags,
      code: "  original code  ",
    });
    const startedBefore = inputStartedAt.getTime();
    const finishedBefore = inputFinishedAt.getTime();

    const result = completeAlgorithmAttempt(input);

    expect(result.attempt.durationSeconds).toBe(2);
    expect(result.attempt.mistakeTags).toEqual(tags);
    expect(result.attempt.code).toBe("  original code  ");
    expect(inputStartedAt.getTime()).toBe(startedBefore);
    expect(inputFinishedAt.getTime()).toBe(finishedBefore);
    expect(input.mistakeTags).toEqual(tags);
  });

  it.each([
    ["id", { id: "  " }],
    ["userId", { userId: "" }],
    ["problemId", { problemId: "\t" }],
    ["startedAt", { startedAt: new Date("invalid") }],
    ["finishedAt", { finishedAt: new Date("invalid") }],
    [
      "finishedAt ordering",
      { finishedAt: new Date("2025-12-31T23:59:59.000Z") },
    ],
  ])("rejects invalid %s", (_name, overrides) => {
    expect(() => completeAlgorithmAttempt(completeInput(overrides))).toThrowError(
      RangeError,
    );
  });

  it("rejects invalid previous state values", () => {
    expect(() =>
      completeAlgorithmAttempt(
        completeInput({ previousState: previousState({ mastery: 101 }) }),
      ),
    ).toThrowError(RangeError);
    expect(() =>
      completeAlgorithmAttempt(
        completeInput({ previousState: previousState({ attemptCount: 1.5 }) }),
      ),
    ).toThrowError(RangeError);
    expect(() =>
      completeAlgorithmAttempt(
        completeInput({
          previousState: previousState({
            lastAttemptAt: "not-a-date",
          }),
        }),
      ),
    ).toThrowError(RangeError);
  });
});
