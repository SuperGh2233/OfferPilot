import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RecallResult } from "../components/knowledge/recall-result";
import { RecallScoreComparison } from "../components/knowledge/recall-score-comparison";
import type { KnowledgeAttemptPayload } from "../lib/knowledge/attempts";

function recallAttempt(answerText: string): KnowledgeAttemptPayload {
  return {
    id: "attempt-1",
    userId: "user-1",
    questionId: "question-1",
    mode: "recall",
    selfRating: null,
    answerText,
    coverageScore: 50,
    effectiveCoverageScore: 50,
    aiAnalysis: null,
    matchedPoints: [],
    missingPoints: [],
    masteryBefore: 55,
    masteryAfter: 55,
    createdAt: "2026-09-16T00:00:00.000Z",
  };
}

describe("Knowledge Recall result", () => {
  it("shows the submitted answer for comparison", () => {
    const html = renderToStaticMarkup(
      <RecallResult attempt={recallAttempt("HashMap 定位桶\n链表处理冲突")} />,
    );

    expect(html).toContain("我的回答");
    expect(html).toContain("HashMap 定位桶\n链表处理冲突");
  });

  it("shows an explicit message when the user could not recall", () => {
    const html = renderToStaticMarkup(<RecallResult attempt={recallAttempt("")} />);

    expect(html).toContain("本次选择：想不起来");
  });
});

describe("Knowledge Recall score comparison", () => {
  it("names both sources and states which score was used", () => {
    const html = renderToStaticMarkup(
      <RecallScoreComparison
        coverageScore={14}
        effectiveCoverageScore={100}
        semanticScore={100}
        verdictLabel="掌握很好"
      />,
    );

    expect(html).toContain("确定性加权覆盖率");
    expect(html).toContain("14%");
    expect(html).toContain("语义覆盖");
    expect(html).toContain("100%");
    expect(html).toContain("掌握很好");
    expect(html).toContain("本次计分采用");
    expect(html).toContain("已按语义覆盖计分");
  });

  it("explains that the deterministic score is the floor", () => {
    const html = renderToStaticMarkup(
      <RecallScoreComparison coverageScore={88} effectiveCoverageScore={88} semanticScore={60} />,
    );

    expect(html).toContain("以确定性加权覆盖率为准");
    expect(html).toContain("不会把错误答案判成高分");
  });

  it("treats a missing effective score as the deterministic score", () => {
    const html = renderToStaticMarkup(
      <RecallScoreComparison coverageScore={null} semanticScore={50} />,
    );

    expect(html).toContain("0%");
    expect(html).toContain("50%");
  });
});
