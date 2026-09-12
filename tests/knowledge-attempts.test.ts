import { describe, expect, it } from "vitest";

import {
  recordKnowledgeLearn,
  recordKnowledgeRecall,
} from "../lib/knowledge/attempts";

const identity = {
  id: "attempt-1",
  userId: "user-1",
  questionId: "question-1",
  attemptedAt: "2026-09-01T00:00:00.000Z",
};

describe("knowledge attempts", () => {
  it("records the first Learn rating and schedules review", () => {
    const result = recordKnowledgeLearn({ ...identity, selfRating: 4 });
    expect(result.attempt).toMatchObject({
      mode: "learn",
      selfRating: 4,
      masteryBefore: null,
      masteryAfter: 55,
    });
    expect(result.state).toMatchObject({
      mastery: 55,
      attemptCount: 1,
      learnCount: 1,
      recallCount: 0,
      status: "learning",
      nextReviewAt: "2026-09-04T00:00:00.000Z",
    });
  });

  it("rejects Learn after the question has already been learned", () => {
    const learned = recordKnowledgeLearn({ ...identity, selfRating: 3 });
    expect(() => recordKnowledgeLearn({
      ...identity,
      id: "attempt-2",
      attemptedAt: "2026-09-02T00:00:00.000Z",
      selfRating: 4,
      previousState: learned.state,
    })).toThrow(/only be recorded/);
  });

  it("matches a Recall, updates mastery and returns explainable points", () => {
    const learned = recordKnowledgeLearn({ ...identity, selfRating: 4 });
    const recalled = recordKnowledgeRecall({
      ...identity,
      id: "attempt-2",
      attemptedAt: "2026-09-04T00:00:00.000Z",
      answerText: "发生 resize",
      keyPoints: ["扩容", "阈值"],
      keywordAliases: { 扩容: ["resize"] },
      keyPointWeights: { "0": 20, "1": 5 },
      previousState: learned.state,
    });
    expect(recalled.attemptScore).toBe(85);
    expect(recalled.attempt).toMatchObject({
      mode: "recall",
      coverageScore: 80,
      masteryBefore: 55,
      masteryAfter: 73,
    });
    expect(recalled.attempt.matchedPoints[0]).toMatchObject({
      point: "扩容",
      matchedBy: "resize",
    });
    expect(recalled.state).toMatchObject({
      attemptCount: 2,
      recallCount: 1,
      status: "learning",
    });
  });

  it("promotes retained high coverage to mastered after seven days", () => {
    const learned = recordKnowledgeLearn({ ...identity, selfRating: 4 });
    const firstRecall = recordKnowledgeRecall({
      ...identity,
      id: "attempt-2",
      attemptedAt: "2026-09-04T00:00:00.000Z",
      answerText: "核心结论",
      keyPoints: ["核心结论"],
      previousState: learned.state,
    });
    const retained = recordKnowledgeRecall({
      ...identity,
      id: "attempt-3",
      attemptedAt: "2026-09-11T00:00:00.000Z",
      answerText: "核心结论",
      keyPoints: ["核心结论"],
      previousState: firstRecall.state,
    });
    expect(retained.state.mastery).toBe(90);
    expect(retained.state.status).toBe("mastered");
    expect(retained.state.recallCount).toBe(2);
  });

  it("treats 'cannot remember' as zero coverage and lowers mastery", () => {
    const learned = recordKnowledgeLearn({ ...identity, selfRating: 4 });
    const recalled = recordKnowledgeRecall({
      ...identity,
      id: "attempt-2",
      attemptedAt: "2026-09-04T00:00:00.000Z",
      answerText: "",
      keyPoints: ["核心结论"],
      previousState: learned.state,
    });
    expect(recalled.attempt.coverageScore).toBe(0);
    expect(recalled.attemptScore).toBe(25);
    expect(recalled.state.mastery).toBe(37);
    expect(recalled.attempt.missingPoints).toHaveLength(1);
  });

  it("rejects Recall before Learn and mismatched ownership", () => {
    const learned = recordKnowledgeLearn({ ...identity, selfRating: 4 });
    expect(() => recordKnowledgeRecall({
      ...identity,
      id: "attempt-2",
      answerText: "",
      keyPoints: [],
      previousState: { ...learned.state, learnCount: 0, attemptCount: 0 },
    })).toThrow(/requires/);
    expect(() => recordKnowledgeRecall({
      ...identity,
      id: "attempt-2",
      answerText: "",
      keyPoints: [],
      previousState: { ...learned.state, userId: "other-user" },
    })).toThrow(/must match/);
  });
});
