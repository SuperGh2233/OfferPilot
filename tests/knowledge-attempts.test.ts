import { describe, expect, it } from "vitest";

import {
  combineRecallCoverage,
  recordKnowledgeLearn,
  recordKnowledgeRecall,
} from "../lib/knowledge/attempts";
import type { KnowledgeRecallAnalysis } from "../lib/ai/knowledge-recall-analysis";

function aiAnalysis(semanticScore: number): KnowledgeRecallAnalysis {
  return {
    semanticScore,
    verdict: "mostly_correct",
    summary: "语义复核说明",
    coveredPoints: [],
    missingPoints: [],
    misconceptions: [],
    improvedAnswer: "更完整的表达",
  };
}

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

describe("knowledge recall AI-dominant scoring", () => {
  const recallInput = {
    ...identity,
    id: "attempt-2",
    attemptedAt: "2026-09-04T00:00:00.000Z",
    keyPoints: ["扩容", "阈值"],
    keywordAliases: { 扩容: ["resize"] },
    keyPointWeights: { "0": 20, "1": 5 },
  };

  it("keeps the deterministic coverage when no AI review was run", () => {
    expect(combineRecallCoverage(80, null)).toBe(80);
  });

  it("lets the AI raise coverage but never lower it", () => {
    expect(combineRecallCoverage(14, aiAnalysis(100))).toBe(100);
    expect(combineRecallCoverage(88, aiAnalysis(60))).toBe(88);
    expect(combineRecallCoverage(80, aiAnalysis(80))).toBe(80);
  });

  it("rejects semantic scores that are not integers within 0..100", () => {
    for (const score of [-1, 101, 80.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => combineRecallCoverage(50, aiAnalysis(score))).toThrow(RangeError);
    }
  });

  it("scores a recall by the AI coverage while keeping the deterministic one", () => {
    const learned = recordKnowledgeLearn({ ...identity, selfRating: 4 });
    const baseline = recordKnowledgeRecall({
      ...recallInput,
      answerText: "完全不知道",
      previousState: learned.state,
    });
    const reviewed = recordKnowledgeRecall({
      ...recallInput,
      answerText: "完全不知道",
      aiAnalysis: aiAnalysis(100),
      previousState: learned.state,
    });

    // 规则没匹配到任何关键点：确定性覆盖为 0，分档落到最低档。
    expect(baseline.attempt.coverageScore).toBe(0);
    expect(baseline.effectiveCoverageScore).toBe(0);
    expect(baseline.attemptScore).toBe(25);

    // AI 语义复核判为完全覆盖：本次按 100 计分，但确定性口径原样保留。
    expect(reviewed.attempt.coverageScore).toBe(0);
    expect(reviewed.attempt.effectiveCoverageScore).toBe(100);
    expect(reviewed.attempt.aiAnalysis?.semanticScore).toBe(100);
    expect(reviewed.attemptScore).toBe(85);
    expect(reviewed.state.lastRecallCoverageScore).toBe(100);
    expect(reviewed.attempt.masteryAfter).toBeGreaterThan(baseline.attempt.masteryAfter);
  });

  it("ignores an AI score below the deterministic coverage", () => {
    const learned = recordKnowledgeLearn({ ...identity, selfRating: 4 });
    const recalled = recordKnowledgeRecall({
      ...recallInput,
      answerText: "发生 resize",
      aiAnalysis: aiAnalysis(30),
      previousState: learned.state,
    });

    expect(recalled.attempt.coverageScore).toBe(80);
    expect(recalled.effectiveCoverageScore).toBe(80);
    expect(recalled.attemptScore).toBe(85);
    expect(recalled.state.lastRecallCoverageScore).toBe(80);
  });
});
