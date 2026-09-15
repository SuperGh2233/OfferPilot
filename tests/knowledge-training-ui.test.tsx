import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RecallResult } from "../components/knowledge/recall-result";
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
