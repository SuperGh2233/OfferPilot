import { describe, expect, it } from "vitest";

import {
  fallbackInterviewFollowUp,
  fallbackInterviewSummary,
  generateInterviewFollowUp,
  generateInterviewSummary,
  parseFollowUp,
  parseSummary,
  validateFollowUpInput,
  validateSummaryInput,
} from "../lib/interview/ai-coach";

const question = {
  question: "HashMap 为什么需要扩容？",
  answer: "因为容量不足。",
  keyPoints: ["容量阈值触发扩容", "重新分配桶位置"],
  missingPoints: [{ index: 1, point: "重新分配桶位置" }],
};

const report = {
  overallScore: 50,
  answered: 4,
  skipped: 1,
  categories: [{ category: "Java集合", score: 50, answered: 4, total: 5 }],
  weakestTopics: [{ topic: "HashMap", category: "Java集合", score: 30 }],
  missingPoints: ["扩容的影响"],
  recommendedTopics: ["HashMap"],
};

describe("Sprint 3 AI interviewer core", () => {
  it("accepts a valid focused follow-up and rejects hallucinated focus points", async () => {
    const result = await generateInterviewFollowUp(question, async () =>
      JSON.stringify({
        question: "扩容时桶的位置如何变化？",
        focusPointIndex: 1,
        rationale: "检查遗漏",
      }),
    );
    expect(result).toMatchObject({ source: "ai", focusPointIndex: 1 });

    const fallback = await generateInterviewFollowUp(question, async () =>
      JSON.stringify({
        question: "随便问",
        focusPointIndex: 99,
        rationale: "错误索引",
      }),
    );
    expect(fallback).toMatchObject({ source: "deterministic", focusPointIndex: 1 });
  });

  it("falls back on model failures, malformed output and duplicate questions", async () => {
    expect((await generateInterviewFollowUp(question, async () => {
      throw new Error("down");
    })).source).toBe("deterministic");
    expect((await generateInterviewFollowUp(question, async () => "{")).source)
      .toBe("deterministic");
    expect(() => parseFollowUp(JSON.stringify({
      question: "已经问过",
      focusPointIndex: 1,
      rationale: "重复",
    }), {
      ...question,
      priorFollowUps: ["已经问过"],
    })).toThrow(TypeError);
  });

  it("rejects forged missing points and blank follow-up history", () => {
    expect(() => validateFollowUpInput({
      ...question,
      missingPoints: [{ index: 1, point: "伪造知识点" }],
    })).toThrow(RangeError);
    expect(() => validateFollowUpInput({
      ...question,
      priorFollowUps: ["   "],
    })).toThrow(RangeError);
  });

  it("uses an application-boundary follow-up when all points are covered", () => {
    const result = fallbackInterviewFollowUp({ ...question, missingPoints: [] });
    expect(result.focusPointIndex).toBeNull();
    expect(result.question).toContain("项目");
  });

  it("accepts strict AI summary and falls back without changing scores", async () => {
    const result = await generateInterviewSummary(report, async () =>
      JSON.stringify({
        strengths: "结构清晰",
        improvements: "补充扩容机制",
        nextStep: "复习 HashMap",
      }),
    );
    expect(result.source).toBe("ai");
    expect(() => parseSummary(JSON.stringify({
      strengths: "ok",
      improvements: "ok",
      nextStep: "ok",
      mastery: 100,
    }))).toThrow(TypeError);

    expect((await generateInterviewSummary(report, async () => "{}")).source)
      .toBe("deterministic");
    expect(fallbackInterviewSummary(report).source).toBe("deterministic");
  });

  it("validates report scores and bounds AI calls with a timeout", async () => {
    expect(() => validateSummaryInput({ ...report, overallScore: 999 })).toThrow(RangeError);

    const followUp = await generateInterviewFollowUp(
      question,
      () => new Promise(() => {}),
      8,
    );
    expect(followUp.source).toBe("deterministic");

    const summary = await generateInterviewSummary(
      report,
      () => new Promise(() => {}),
      8,
    );
    expect(summary.source).toBe("deterministic");
  });
});
