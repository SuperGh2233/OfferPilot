import { RecallScoreComparison } from "./recall-score-comparison";
import type { KnowledgeRecallHistory } from "../../lib/knowledge/recall-history";

function MissingList({ title, points }: { title: string; points: readonly string[] }) {
  return (
    <div>
      <p className="text-sm font-medium">{title} · {points.length}</p>
      {points.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
          {points.map((point, index) => <li className="break-words" key={`${index}-${point}`}>• {point}</li>)}
        </ul>
      ) : <p className="mt-1 text-xs text-muted-foreground">无</p>}
    </div>
  );
}

/** 历史分析必须使用 Attempt 当时保存的关键点，不能以新题库的 index 回填旧答案。 */
export function RecallHistoryPanel({
  history,
  timeZone,
  expanded = false,
}: {
  history: KnowledgeRecallHistory;
  timeZone: string;
  expanded?: boolean;
}) {
  const { latest, previous, comparison } = history;
  if (!latest) return null;
  const analysis = latest.aiAnalysis;
  const pointSnapshot = new Map<number, string>(
    [...latest.matchedPoints, ...latest.missingPoints].map((point): [number, string] => [point.index, point.point]),
  );
  const timestamp = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium", timeStyle: "short", timeZone,
  }).format(new Date(latest.createdAt));
  const previousTimestamp = previous ? new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium", timeStyle: "short", timeZone,
  }).format(new Date(previous.createdAt)) : null;
  const displayScore = (value: number | null) => value === null ? "—" : `${value}%`;

  return (
    <details className="rounded-2xl border bg-card p-5 shadow-sm" open={expanded || undefined}>
      <summary className="cursor-pointer font-semibold">回忆历史对比 · {history.count} 次（查看复习提示）</summary>
      <div className="mt-4 space-y-5 border-t pt-4">
        <div className="text-sm leading-6 text-muted-foreground">
          <p>本次/最近一次：{timestamp} · 实际计分覆盖率 {displayScore(latest.effectiveCoverageScore ?? latest.coverageScore)}</p>
          {previous ? (
            <p>上一次：{previousTimestamp} · 实际计分覆盖率 {displayScore(previous.effectiveCoverageScore ?? previous.coverageScore)}</p>
          ) : <p>当前只有一次 Recall；完成下一次后会显示两次之间的遗漏变化。</p>}
        </div>
        {comparison ? (
          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="text-sm font-semibold">上一次与本次遗漏对比</h3>
            <p className="text-xs text-muted-foreground">
              对比依据：{comparison.basis === "ai" ? "两次均已保存的 AI 语义关键点" : "两次的确定性关键点（至少一次缺少可用 AI 分析）"}。只对两次可对应的关键点判断变化；实际计分可能采用不同口径。
            </p>
            <MissingList title="连续两次遗漏" points={comparison.persistent} />
            <MissingList title="这次新遗漏" points={comparison.newlyMissing} />
            <MissingList title="这次补上了" points={comparison.resolved} />
            {comparison.notComparable.length > 0 ? (
              <p className="text-xs leading-5 text-amber-700 dark:text-amber-400">
                有 {comparison.notComparable.length} 个本次遗漏点无法对应到上次保存的关键点（参考答案可能已修订），没有计为“新遗忘”。
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="rounded-xl bg-muted p-4">
          <h3 className="text-sm font-semibold">下次复习 · 聚焦一个点</h3>
          <p className="mt-2 break-words text-sm leading-6">{history.hint}</p>
          <p className="mt-2 text-xs text-muted-foreground">提示从已保存的遗漏或误区生成，不重新调用 AI，也不修改复习日期或 Mastery。</p>
        </div>
        {analysis ? (
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-semibold">查看最近一次已保存的 AI 复核</summary>
            <div className="mt-4 space-y-3 text-sm leading-6">
              <RecallScoreComparison
                coverageScore={latest.coverageScore}
                effectiveCoverageScore={latest.effectiveCoverageScore}
                semanticScore={analysis.semanticScore}
              />
              <p className="whitespace-pre-wrap break-words">{analysis.summary}</p>
              {analysis.missingPoints.length > 0 ? (
                <div>
                  <p className="font-medium">当次语义遗漏</p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {analysis.missingPoints.map((point) => (
                      <li key={point.index} className="break-words">△ {pointSnapshot.get(point.index) ?? `旧版关键点 ${point.index + 1}`}：{point.guidance}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {analysis.misconceptions.length > 0 ? (
                <MissingList title="当次事实误区" points={analysis.misconceptions} />
              ) : null}
              <p className="font-medium">当次建议回答</p>
              <p className="whitespace-pre-wrap break-words text-muted-foreground">{analysis.improvedAnswer}</p>
            </div>
          </details>
        ) : <p className="text-xs text-muted-foreground">最近一次 Recall 没有已保存的 AI 分析；其确定性遗漏仍可用于下次复习提示。</p>}
      </div>
    </details>
  );
}
