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
  it("labels which score counts toward mastery", () => {
    const html = renderToStaticMarkup(
      <RecallScoreComparison coverageScore={14} semanticScore={100} verdictLabel="掌握很好" />,
    );

    expect(html).toContain("加权覆盖率");
    expect(html).toContain("14%");
    expect(html).toContain("语义覆盖");
    expect(html).toContain("100%");
    expect(html).toContain("掌握很好");
    expect(html).toContain("已计入 Mastery 与下次复习");
    expect(html).toContain("仅供参考，不改变 Mastery");
  });

  it("explains why the two scores legitimately differ", () => {
    const html = renderToStaticMarkup(<RecallScoreComparison coverageScore={12} semanticScore={88} />);

    expect(html).toContain("口径不同");
    expect(html).toContain("口语化或同义表达会被漏计");
    expect(html).toContain("计分始终以加权覆盖率为准");
  });

  it("falls back to zero when the deterministic score is missing", () => {
    const html = renderToStaticMarkup(<RecallScoreComparison coverageScore={null} semanticScore={50} />);

    expect(html).toContain("0%");
    expect(html).toContain("50%");
  });
});
