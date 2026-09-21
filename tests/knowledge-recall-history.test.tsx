import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RecallHistoryPanel } from "../components/knowledge/recall-history-panel";
import type { KnowledgeRecallAnalysis } from "../lib/ai/knowledge-recall-analysis";
import type { KnowledgeAttemptPayload } from "../lib/knowledge/attempts";
import { compareKnowledgeRecalls, getKnowledgeRecallHistory } from "../lib/knowledge/recall-history";
import { knowledgeAttemptFromRow } from "../lib/supabase/training";
import type { Json, KnowledgeAttempt } from "../types/database";

const points = ["哈希定位", "equals 检查", "冲突处理"];

function analysis(missing: number[], score: number): KnowledgeRecallAnalysis {
  return {
    semanticScore: score,
    verdict: "partial",
    summary: "已识别部分核心知识点。",
    coveredPoints: points.map((_, index) => index).filter((index) => !missing.includes(index))
      .map((index) => ({ index, evidence: `答出了 ${points[index]}` })),
    missingPoints: missing.map((index) => ({ index, guidance: `补充 ${points[index]}` })),
    misconceptions: [],
    improvedAnswer: "应结合哈希定位、equals 和冲突处理回答。",
  };
}

function attempt(id: string, missing: number[], ai: KnowledgeRecallAnalysis | null = null): KnowledgeAttemptPayload {
  return {
    id, userId: "user-1", questionId: "question-1", mode: "recall", selfRating: null,
    answerText: "这是当次记录的回答", coverageScore: 40, effectiveCoverageScore: ai?.semanticScore ?? 40,
    aiAnalysis: ai,
    matchedPoints: points.map((point, index) => ({ index, point, weight: 5, matchedBy: point }))
      .filter((point) => !missing.includes(point.index)),
    missingPoints: missing.map((index) => ({ index, point: points[index], weight: 5 })),
    masteryBefore: 40, masteryAfter: 45,
    createdAt: id === "old" ? "2026-09-18T02:00:00.000Z" : "2026-09-20T02:00:00.000Z",
  };
}

describe("Knowledge Recall history and focused next review", () => {
  it("compares the same persisted AI key points and selects one repeated omission", () => {
    const old = attempt("old", [1, 2], analysis([1, 2], 35));
    const current = attempt("new", [0, 2], analysis([0, 2], 65));
    const history = getKnowledgeRecallHistory([old, current], "question-1");

    expect(history.count).toBe(2);
    expect(history.latest?.id).toBe("new");
    expect(history.previous?.id).toBe("old");
    expect(history.comparison).toEqual({
      basis: "ai", persistent: ["冲突处理"], newlyMissing: ["哈希定位"], resolved: ["equals 检查"],
      notComparable: [], previousScore: 35, currentScore: 65,
    });
    expect(history.hint).toContain("冲突处理");
    expect(history.hint).toContain("补充 冲突处理");
  });

  it("uses one consistent deterministic comparison when only one attempt has AI", () => {
    const history = getKnowledgeRecallHistory([
      attempt("old", [1, 2], analysis([1, 2], 35)),
      attempt("new", [0, 2]),
    ], "question-1");
    expect(history.comparison?.basis).toBe("deterministic");
    expect(history.comparison?.persistent).toEqual(["冲突处理"]);
    expect(history.comparison?.resolved).toEqual(["equals 检查"]);
  });

  it("does not mistake renamed source key points for a newly forgotten fact", () => {
    const old = attempt("old", [2], analysis([2], 35));
    const current = attempt("new", [2], analysis([2], 65));
    current.missingPoints = [{ index: 2, point: "新的冲突处理关键点", weight: 5 }];
    const compared = compareKnowledgeRecalls(old, current);
    expect(compared.persistent).toEqual([]);
    expect(compared.newlyMissing).toEqual([]);
    expect(compared.notComparable).toEqual(["新的冲突处理关键点"]);
  });

  it("ignores Learn and unrelated questions and deduplicates retried mutation IDs", () => {
    const old = attempt("old", [0]);
    const current = attempt("new", [2]);
    const another = { ...current, id: "elsewhere", questionId: "question-2" };
    const learned = { ...old, id: "learned", mode: "learn" as const };
    const history = getKnowledgeRecallHistory([old, current, current, another, learned], "question-1", current);
    expect(history.count).toBe(2);
    expect(history.latest?.id).toBe("new");
    expect(history.previous?.id).toBe("old");
  });

  it("restores persisted AI analysis from a database row after refresh and renders it", () => {
    const current = attempt("new", [2], analysis([2], 72));
    const databaseRow: KnowledgeAttempt = {
      id: current.id, user_id: current.userId, question_id: current.questionId,
      mode: "recall", self_rating: null, answer_text: current.answerText,
      coverage_score: current.coverageScore, effective_coverage_score: current.effectiveCoverageScore,
      ai_analysis: current.aiAnalysis as unknown as Json, matched_points: current.matchedPoints as unknown as Json,
      missing_points: current.missingPoints as unknown as Json, mastery_before: current.masteryBefore,
      mastery_after: current.masteryAfter, created_at: current.createdAt, updated_at: current.createdAt,
    };
    const restored = knowledgeAttemptFromRow(databaseRow);
    expect(restored.aiAnalysis?.semanticScore).toBe(72);
    const history = getKnowledgeRecallHistory([restored], "question-1");
    const html = renderToStaticMarkup(<RecallHistoryPanel history={history} timeZone="Asia/Shanghai" expanded />);
    expect(html).toContain("回忆历史对比");
    expect(html).toContain("查看最近一次已保存的 AI 复核");
    expect(html).toContain("已识别部分核心知识点");
    expect(html).toContain("下次复习 · 聚焦一个点");
    expect(html).toContain("冲突处理");
  });

  it("renders the deterministic hint when historical AI is unavailable", () => {
    const history = getKnowledgeRecallHistory([attempt("new", [1])], "question-1");
    const html = renderToStaticMarkup(<RecallHistoryPanel history={history} timeZone="Asia/Shanghai" />);
    expect(html).toContain("equals 检查");
    expect(html).toContain("没有已保存的 AI 分析");
    expect(html).toContain("只有一次 Recall");
  });
});
