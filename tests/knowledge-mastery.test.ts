import { describe, expect, it } from "vitest";

import {
  calculateKnowledgeLearnMastery,
  calculateKnowledgeRecallAttemptScore,
  calculateKnowledgeTopicMastery,
  calculateNextKnowledgeReview,
  isKnowledgeMastered,
  updateKnowledgeMastery,
} from "../lib/mastery/knowledge";

describe("knowledge mastery", () => {
  it.each([
    [1, 15],
    [2, 30],
    [3, 45],
    [4, 55],
  ] as const)("maps Learn rating %s to %s mastery", (rating, mastery) => {
    expect(calculateKnowledgeLearnMastery(rating)).toBe(mastery);
  });

  it.each([
    [0, 25],
    [20, 25],
    [20.01, 40],
    [40, 40],
    [40.01, 55],
    [60, 55],
    [60.01, 70],
    [79.99, 70],
    [80, 85],
    [100, 85],
  ])("maps %s%% coverage to %s recall score", (coverage, score) => {
    expect(calculateKnowledgeRecallAttemptScore(coverage)).toBe(score);
  });

  it("smooths existing mastery and only grants the 90 floor for retained recall", () => {
    const recalledAt = new Date("2026-09-09T02:00:00.000Z");
    expect(updateKnowledgeMastery({
      oldMastery: 55,
      attemptScore: 85,
      coverageScore: 80,
      lastRecallAt: new Date("2026-09-03T02:00:00.000Z"),
      recalledAt,
    })).toBe(73);
    expect(updateKnowledgeMastery({
      oldMastery: 55,
      attemptScore: 85,
      coverageScore: 80,
      lastRecallAt: new Date("2026-09-02T02:00:00.000Z"),
      recalledAt,
    })).toBe(90);
    expect(updateKnowledgeMastery({
      oldMastery: 85,
      attemptScore: 70,
      coverageScore: 79.99,
      lastRecallAt: new Date("2026-09-01T02:00:00.000Z"),
      recalledAt,
    })).toBe(76);
  });

  it.each([
    [29.99, 1],
    [30, 2],
    [45, 3],
    [60, 5],
    [75, 7],
    [85, 14],
    [92, 21],
  ])("schedules mastery %s after %s day(s)", (mastery, days) => {
    const from = new Date("2026-09-09T02:00:00.000Z");
    expect(calculateNextKnowledgeReview(mastery, from).getTime()).toBe(
      from.getTime() + days * 24 * 60 * 60 * 1000,
    );
  });

  it("requires at least one Recall before mastered", () => {
    expect(isKnowledgeMastered({ mastery: 90, recallCount: 0 })).toBe(false);
    expect(isKnowledgeMastered({ mastery: 85, recallCount: 1 })).toBe(true);
  });

  it("weights topic mastery by importance and halves follow-up influence", () => {
    expect(calculateKnowledgeTopicMastery([
      { mastery: 80, importance: 4, questionType: "main" },
      { mastery: 20, importance: 4, questionType: "follow_up" },
    ])).toBe(60);
    expect(calculateKnowledgeTopicMastery([
      { mastery: null, importance: 5, questionType: "main" },
    ])).toBe(0);
    expect(calculateKnowledgeTopicMastery([])).toBe(0);
  });

  it("rejects invalid scoring inputs and reversed recall dates", () => {
    expect(() => calculateKnowledgeRecallAttemptScore(101)).toThrow(/between 0 and 100/);
    expect(() => updateKnowledgeMastery({
      oldMastery: 55,
      attemptScore: 85,
      coverageScore: 80,
      lastRecallAt: "2026-09-10T00:00:00.000Z",
      recalledAt: "2026-09-09T00:00:00.000Z",
    })).toThrow(/later/);
  });
});
