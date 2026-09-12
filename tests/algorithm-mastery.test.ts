import { describe, expect, it } from "vitest";

import {
  calculateAlgorithmAttemptScore,
  calculateNextAlgorithmReview,
  isAlgorithmMastered,
  updateAlgorithmMastery,
  type AlgorithmAttemptScoreInput,
  type AlgorithmDifficulty,
  type AlgorithmMasteryUpdateInput,
} from "../lib/mastery/algorithm";

const attempt = (
  overrides: Partial<AlgorithmAttemptScoreInput> = {},
): AlgorithmAttemptScoreInput => ({
  difficulty: "medium",
  durationSeconds: 40 * 60,
  result: "first_ac",
  independence: "independent",
  waCount: 1,
  ...overrides,
});

const attemptedAt = new Date("2026-01-08T00:00:00.000Z");
const lastAttemptAt = new Date("2026-01-01T00:00:00.000Z");

const masteryUpdate = (
  overrides: Partial<AlgorithmMasteryUpdateInput> = {},
): AlgorithmMasteryUpdateInput => ({
  oldMastery: 40,
  attemptScore: 80,
  result: "first_ac",
  independence: "independent",
  lastAttemptAt,
  attemptedAt,
  ...overrides,
});

describe("updateAlgorithmMastery", () => {
  it.each([
    ["first attempt", masteryUpdate({ oldMastery: null }), 80],
    ["smooth update", masteryUpdate({ lastAttemptAt: null }), 64],
    [
      "independent AC after three days",
      masteryUpdate({
        lastAttemptAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      67,
    ],
    ["independent AC after seven days", masteryUpdate(), 69],
    ["non-independent AC", masteryUpdate({ independence: "small_hint" }), 64],
    ["failed attempt", masteryUpdate({ result: "failed" }), 25],
  ])("handles %s", (_name, input, expected) => {
    expect(updateAlgorithmMastery(input)).toBe(expected);
  });

  it.each([
    ["high mastery", 92, 100, 77],
    ["low mastery", 10, 0, 0],
  ])(
    "keeps a failed attempt from staying too high (%s)",
    (_name, oldMastery, attemptScore, expected) => {
      expect(
        updateAlgorithmMastery(
          masteryUpdate({ oldMastery, attemptScore, result: "failed" }),
        ),
      ).toBe(expected);
    },
  );

  it.each([
    ["oldMastery", { oldMastery: -1 }],
    ["oldMastery", { oldMastery: 101 }],
    ["attemptScore", { attemptScore: -1 }],
    ["attemptScore", { attemptScore: 101 }],
    ["attemptedAt", { attemptedAt: new Date("invalid") }],
    ["lastAttemptAt", { lastAttemptAt: new Date("invalid") }],
    [
      "lastAttemptAt ordering",
      { lastAttemptAt: new Date("2026-01-09T00:00:00.000Z") },
    ],
  ])("rejects invalid %s", (_name, overrides) => {
    expect(() => updateAlgorithmMastery(masteryUpdate(overrides))).toThrowError(
      RangeError,
    );
  });
});

describe("calculateNextAlgorithmReview", () => {
  const reviewCases: [number, string][] = [
    [0, "2026-01-02T00:00:00.000Z"],
    [39.99, "2026-01-02T00:00:00.000Z"],
    [40, "2026-01-03T00:00:00.000Z"],
    [59.99, "2026-01-03T00:00:00.000Z"],
    [60, "2026-01-04T00:00:00.000Z"],
    [74.99, "2026-01-04T00:00:00.000Z"],
    [75, "2026-01-06T00:00:00.000Z"],
    [84.99, "2026-01-06T00:00:00.000Z"],
    [85, "2026-01-08T00:00:00.000Z"],
    [91.99, "2026-01-08T00:00:00.000Z"],
    [92, "2026-01-15T00:00:00.000Z"],
    [100, "2026-01-15T00:00:00.000Z"],
  ];

  it.each(reviewCases)(
    "uses the review interval for mastery %d",
    (mastery, expected) => {
      expect(
        calculateNextAlgorithmReview(
          mastery,
          new Date("2026-01-01T00:00:00.000Z"),
        ).toISOString(),
      ).toBe(expected);
    },
  );

  it("does not mutate the input Date", () => {
    const from = new Date("2026-01-01T12:34:56.789Z");
    const before = from.getTime();
    const nextReview = calculateNextAlgorithmReview(85, from);

    expect(from.getTime()).toBe(before);
    expect(nextReview).not.toBe(from);
    expect(nextReview.toISOString()).toBe("2026-01-08T12:34:56.789Z");
  });

  it.each([
    ["mastery", -1, new Date("2026-01-01T00:00:00.000Z")],
    ["mastery", 101, new Date("2026-01-01T00:00:00.000Z")],
    ["from", 85, new Date("invalid")],
  ])("rejects invalid %s", (_name, mastery, from) => {
    expect(() => calculateNextAlgorithmReview(mastery, from)).toThrowError(
      RangeError,
    );
  });
});

describe("isAlgorithmMastered", () => {
  it.each([
    [
      "all conditions",
      { mastery: 85, attemptCount: 2, spacedIndependentAcAt: lastAttemptAt },
      true,
    ],
    [
      "mastery below threshold",
      { mastery: 84.99, attemptCount: 2, spacedIndependentAcAt: lastAttemptAt },
      false,
    ],
    [
      "not enough attempts",
      { mastery: 90, attemptCount: 1, spacedIndependentAcAt: lastAttemptAt },
      false,
    ],
    [
      "no spaced independent AC",
      { mastery: 90, attemptCount: 2, spacedIndependentAcAt: null },
      false,
    ],
  ])("requires %s", (_name, input, expected) => {
    expect(isAlgorithmMastered(input)).toBe(expected);
  });

  it.each([
    [
      "mastery",
      { mastery: -1, attemptCount: 2, spacedIndependentAcAt: lastAttemptAt },
    ],
    [
      "attemptCount",
      { mastery: 90, attemptCount: 1.5, spacedIndependentAcAt: lastAttemptAt },
    ],
    [
      "spacedIndependentAcAt",
      { mastery: 90, attemptCount: 2, spacedIndependentAcAt: "invalid" },
    ],
  ])("rejects invalid %s", (_name, input) => {
    expect(() => isAlgorithmMastered(input)).toThrowError(RangeError);
  });
});

describe("calculateAlgorithmAttemptScore", () => {
  it.each([
    ["failed takes priority", attempt({ result: "failed" }), 15],
    [
      "full solution",
      attempt({ independence: "full_solution" }),
      30,
    ],
    ["solution hint", attempt({ independence: "solution_hint" }), 50],
    ["small hint", attempt({ independence: "small_hint" }), 68],
    [
      "independent after wrong answers",
      attempt({ result: "wa_then_ac" }),
      78,
    ],
    ["independent first AC", attempt(), 85],
  ])("uses the expected base score for %s", (_name, input, expected) => {
    expect(calculateAlgorithmAttemptScore(input)).toBe(expected);
  });

  const timeCases: [
    AlgorithmDifficulty,
    number,
    number,
  ][] = [
    ["easy", 15, 90],
    ["easy", 25, 85],
    ["easy", 40, 80],
    ["easy", 41, 75],
    ["medium", 25, 90],
    ["medium", 40, 85],
    ["medium", 60, 80],
    ["medium", 61, 75],
    ["hard", 40, 90],
    ["hard", 60, 85],
    ["hard", 90, 80],
    ["hard", 91, 75],
  ];

  it.each(timeCases)(
    "%s applies the correct time adjustment at %d minutes",
    (difficulty, minutes, expected) => {
      expect(
        calculateAlgorithmAttemptScore(
          attempt({ difficulty, durationSeconds: minutes * 60 }),
        ),
      ).toBe(expected);
    },
  );

  it.each([
    [0, 88],
    [1, 85],
    [2, 82],
    [3, 78],
  ])("applies the WA adjustment for %d wrong answers", (waCount, expected) => {
    expect(
      calculateAlgorithmAttemptScore(
        attempt({ difficulty: "easy", durationSeconds: 25 * 60, waCount }),
      ),
    ).toBe(expected);
  });

  it("clamps a low score to zero", () => {
    expect(
      calculateAlgorithmAttemptScore(
        attempt({
          difficulty: "hard",
          durationSeconds: 91 * 60,
          result: "failed",
          waCount: 3,
        }),
      ),
    ).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid durationSeconds: %s",
    (durationSeconds) => {
      expect(() =>
        calculateAlgorithmAttemptScore(attempt({ durationSeconds })),
      ).toThrowError(RangeError);
    },
  );

  it.each([-1, 1.5, 4, Number.NaN])(
    "rejects invalid waCount: %s",
    (waCount) => {
      expect(() =>
        calculateAlgorithmAttemptScore(attempt({ waCount })),
      ).toThrowError(RangeError);
    },
  );
});
