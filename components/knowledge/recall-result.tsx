import type { KnowledgeAttemptPayload } from "../../lib/knowledge/attempts";

export function RecallResult({ attempt }: { attempt: KnowledgeAttemptPayload }) {
  const hasAnswer = Boolean(attempt.answerText?.trim());

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border bg-muted/30 p-5">
        <h2 className="font-semibold">我的回答</h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/80">
          {hasAnswer ? attempt.answerText : "本次选择：想不起来"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-card p-5 dark:border-emerald-900">
          <h2 className="font-semibold text-emerald-800 dark:text-emerald-400">你记住了 · {attempt.matchedPoints.length}</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6">
            {attempt.matchedPoints.map((point) => <li key={point.index}>✓ {point.point}</li>)}
            {attempt.matchedPoints.length === 0 ? <li className="text-muted-foreground">暂无匹配关键点</li> : null}
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-card p-5 dark:border-amber-900">
          <h2 className="font-semibold text-amber-800 dark:text-amber-400">还遗漏 · {attempt.missingPoints.length}</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6">
            {attempt.missingPoints.map((point) => <li key={point.index}>△ {point.point}</li>)}
            {attempt.missingPoints.length === 0 ? <li className="text-muted-foreground">关键点全部覆盖</li> : null}
          </ul>
        </div>
        <p className="sm:col-span-2 text-sm text-muted-foreground">
          确定性加权覆盖率：{attempt.coverageScore ?? 0}%
          {typeof attempt.effectiveCoverageScore === "number"
            && attempt.effectiveCoverageScore !== (attempt.coverageScore ?? 0)
            ? `（本次计分采用 ${attempt.effectiveCoverageScore}%）`
            : ""}
        </p>
      </div>
    </div>
  );
}
