import { describe, expect, it } from "vitest";

import {
  requestInterviewFollowUp,
  requestInterviewSummary,
  type FetchLike,
} from "../lib/interview/ai-coach-client";

const fallbackInput = {
  question: "HashMap 为什么扩容？",
  answer: "容量不足时扩容",
  keyPoints: ["容量阈值", "重新分配桶位置"],
  missingPoints: [{ index: 1, point: "重新分配桶位置" }],
};

const report = {
  overallScore: 60,
  answered: 4,
  skipped: 1,
  categories: [{ category: "Java集合", score: 60, answered: 4, total: 5 }],
  weakestTopics: [{ topic: "HashMap", category: "Java集合", score: 30 }],
  missingPoints: ["重新分配桶位置"],
  recommendedTopics: ["HashMap"],
};

function response(ok: boolean, payload: unknown) {
  return { ok, async json() { return payload; } };
}

describe("Sprint 3 AI interview browser transport", () => {
  it("accepts valid follow-up and summary envelopes", async () => {
    const followUp = await requestInterviewFollowUp({
      questionId: "q1",
      answerText: "回答",
      fallbackInput,
    }, async () => response(true, {
      followUp: {
        question: "桶位置怎么变化？",
        focusPointIndex: 1,
        rationale: "遗漏点",
        source: "ai",
      },
    }));
    expect(followUp.source).toBe("ai");

    const summary = await requestInterviewSummary(report, async () => response(true, {
      summary: {
        strengths: "基础尚可",
        improvements: "补充扩容",
        nextStep: "复习 HashMap",
        source: "ai",
      },
    }));
    expect(summary.source).toBe("ai");
  });

  it("falls back on non-ok, malformed body and network failure", async () => {
    const fetchers: FetchLike[] = [
      async () => response(false, {}),
      async () => response(true, {
        followUp: { question: "x", focusPointIndex: -1, rationale: "x", source: "ai" },
      }),
      async () => response(true, {
        followUp: { question: "错误知识点", focusPointIndex: 0, rationale: "不属于遗漏点", source: "ai" },
      }),
      async () => { throw new Error("offline"); },
    ];

    for (const fetcher of fetchers) {
      const result = await requestInterviewFollowUp({
        questionId: "q1",
        answerText: "回答",
        fallbackInput,
      }, fetcher);
      expect(result.source).toBe("deterministic");
    }

    expect((await requestInterviewSummary(
      report,
      async () => response(true, { summary: {} }),
    )).source).toBe("deterministic");
  });

  it("rethrows an aborted request so stale UI results can be ignored", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(requestInterviewFollowUp({
      questionId: "q1",
      answerText: "回答",
      fallbackInput,
    }, async (_url, init) => {
      throw init.signal?.reason ?? new Error("aborted");
    }, controller.signal)).rejects.toBeDefined();
  });
});
