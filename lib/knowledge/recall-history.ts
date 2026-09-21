import type { KnowledgeAttemptPayload } from "./attempts";

/** 只比较同一道题真正落库的 Recall；Learn 和其他题目不参与。 */
type RecallAttempt = KnowledgeAttemptPayload;
type Point = { key: string; text: string; guidance: string | null };

export type KnowledgeRecallComparison = {
  basis: "ai" | "deterministic";
  persistent: string[];
  newlyMissing: string[];
  resolved: string[];
  /** 关键点原文发生变化时，不把无法比较的点误判成知识遗忘。 */
  notComparable: string[];
  previousScore: number | null;
  currentScore: number | null;
};

export type KnowledgeRecallHistory = {
  latest: RecallAttempt | null;
  previous: RecallAttempt | null;
  count: number;
  comparison: KnowledgeRecallComparison | null;
  hint: string | null;
};

function pointKey(text: string): string {
  return text.normalize("NFKC").trim().toLocaleLowerCase("zh-CN").replace(/\s+/gu, "");
}

function pointSnapshot(attempt: RecallAttempt): Map<number, string> {
  const points = new Map<number, string>();
  for (const point of [...attempt.matchedPoints, ...attempt.missingPoints]) {
    if (point && typeof point.point === "string" && Number.isSafeInteger(point.index) && point.index >= 0 && point.point.trim()) {
      points.set(point.index, point.point);
    }
  }
  return points;
}

function allPoints(attempt: RecallAttempt): Map<string, string> {
  return new Map<string, string>(
    [...pointSnapshot(attempt).values()].map((text): [string, string] => [pointKey(text), text]),
  );
}

/** AI 的 index 必须映射到当次 Attempt 保存的关键点原文，不能索引当前（可能已修订）的题库。 */
function missingPoints(attempt: RecallAttempt, useAi: boolean): Point[] | null {
  if (!useAi) return attempt.missingPoints
    .filter((point) => point && typeof point.point === "string" && point.point.trim())
    .map((point) => ({ key: pointKey(point.point), text: point.point, guidance: null }));
  if (!attempt.aiAnalysis) return null;
  const snapshot = pointSnapshot(attempt);
  const result: Point[] = [];
  for (const missing of attempt.aiAnalysis.missingPoints) {
    const text = snapshot.get(missing.index);
    if (!text) return null;
    result.push({ key: pointKey(text), text, guidance: missing.guidance });
  }
  return result;
}

function score(attempt: RecallAttempt): number | null {
  return attempt.effectiveCoverageScore ?? attempt.coverageScore;
}

function concise(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/gu, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}…` : compact;
}

function focusedHint(attempt: RecallAttempt, persistentKeys: ReadonlySet<string>): string {
  const omissions = missingPoints(attempt, Boolean(attempt.aiAnalysis))
    ?? missingPoints(attempt, false)
    ?? [];
  const selected = omissions.find((point) => persistentKeys.has(point.key)) ?? omissions[0];
  if (selected) {
    return `下次优先回忆「${concise(selected.text, 100)}」。${selected.guidance ? concise(selected.guidance, 120) : "先不看答案，用自己的话补全这个关键点。"}`;
  }
  const misconception = attempt.aiAnalysis?.misconceptions[0];
  if (misconception) return `下次重点纠正：${concise(misconception, 160)}`;
  const firstPoint = pointSnapshot(attempt).values().next().value;
  return firstPoint
    ? `下次不看答案，独立解释「${concise(firstPoint, 100)}」并举一个例子。`
    : "下次先独立复述核心概念，再对照参考答案自查。";
}

/**
 * 仅比较两次都有快照的同一关键点。若一方缺 AI，则两次统一用确定性匹配口径，
 * 避免把评分口径变化误读为进步或退步；不修改历史 Attempt 或 Mastery。
 */
export function compareKnowledgeRecalls(previous: RecallAttempt, current: RecallAttempt): KnowledgeRecallComparison {
  const aiPrevious = missingPoints(previous, true);
  const aiCurrent = missingPoints(current, true);
  const basis = aiPrevious !== null && aiCurrent !== null ? "ai" : "deterministic";
  const priorOmissions = missingPoints(previous, basis === "ai") ?? [];
  const currentOmissions = missingPoints(current, basis === "ai") ?? [];
  const priorAll = allPoints(previous);
  const currentAll = allPoints(current);
  const priorMissingKeys = new Set(priorOmissions.map((point) => point.key));
  const currentMissingKeys = new Set(currentOmissions.map((point) => point.key));

  return {
    basis,
    persistent: currentOmissions.filter((point) => priorMissingKeys.has(point.key)).map((point) => point.text),
    newlyMissing: currentOmissions.filter((point) => priorAll.has(point.key) && !priorMissingKeys.has(point.key)).map((point) => point.text),
    resolved: priorOmissions.filter((point) => currentAll.has(point.key) && !currentMissingKeys.has(point.key)).map((point) => point.text),
    notComparable: currentOmissions.filter((point) => !priorAll.has(point.key)).map((point) => point.text),
    previousScore: score(previous),
    currentScore: score(current),
  };
}

/** 重复增量写入按 Attempt ID 去重；有刚提交结果时优先使用该结果而非旧快照。 */
export function getKnowledgeRecallHistory(
  attempts: readonly RecallAttempt[],
  questionId: string,
  submitted: RecallAttempt | null = null,
): KnowledgeRecallHistory {
  const unique = new Map<string, RecallAttempt>();
  for (const attempt of attempts) {
    if (attempt.questionId === questionId && attempt.mode === "recall") unique.set(attempt.id, attempt);
  }
  if (submitted?.questionId === questionId && submitted.mode === "recall") {
    unique.set(submitted.id, submitted);
  }
  const sorted = [...unique.values()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
  );
  const latest = submitted?.questionId === questionId && submitted.mode === "recall"
    ? unique.get(submitted.id) ?? null
    : sorted[0] ?? null;
  // 同一 Attempt 被重放或跨标签页晚到时，不把时间更晚的记录称为“上一次”。
  const latestPosition = sorted.findIndex((attempt) => attempt.id === latest?.id);
  const previous = sorted.slice(latestPosition + 1)[0] ?? null;
  if (!latest) return { latest: null, previous: null, count: 0, comparison: null, hint: null };
  const comparison = previous ? compareKnowledgeRecalls(previous, latest) : null;
  const persistentKeys = new Set((comparison?.persistent ?? []).map(pointKey));
  return {
    latest,
    previous,
    count: sorted.length,
    comparison,
    hint: focusedHint(latest, persistentKeys),
  };
}
