/**
 * 并列展示两个口径的分数，避免用户误以为「AI 复核后分数没生效」。
 *
 * 加权覆盖率是确定性关键词匹配的结果，计入 Mastery 与下次复习；
 * 语义覆盖是 AI 复核的结果，只用于解释，不改变 Mastery。
 * 两者口径不同，数值不一致是正常现象，必须在界面上说清楚。
 */
export function RecallScoreComparison({
  coverageScore,
  effectiveCoverageScore,
  semanticScore,
  verdictLabel,
}: {
  coverageScore: number | null | undefined;
  effectiveCoverageScore?: number | null;
  semanticScore: number;
  verdictLabel?: string;
}) {
  const deterministic = coverageScore ?? 0;
  const scored = effectiveCoverageScore ?? deterministic;
  const raisedByAi = scored > deterministic;

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        两个分数口径不同，不必一致
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-xs text-emerald-800 dark:text-emerald-300">确定性加权覆盖率</p>
          <p className="mt-1 text-xl font-semibold text-emerald-900 dark:text-emerald-200">
            {`${deterministic}%`}
          </p>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
            只匹配关键点原文与已登记别名
          </p>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40">
          <p className="text-xs text-sky-800 dark:text-sky-300">
            语义覆盖 · AI 复核{verdictLabel ? ` · ${verdictLabel}` : ""}
          </p>
          <p className="mt-1 text-xl font-semibold text-sky-900 dark:text-sky-200">{`${semanticScore}%`}</p>
          <p className="mt-1 text-xs text-sky-800/80 dark:text-sky-300/80">
            按含义判断同义与口语表达
          </p>
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-muted p-3 text-sm leading-6">
        本次计分采用 <span className="font-semibold">{`${scored}%`}</span>
        {raisedByAi
          ? `：AI 语义复核高于确定性匹配，已按语义覆盖计分，Mastery 与下次复习据此更新。`
          : "：以确定性加权覆盖率为准（高于或等于语义覆盖时不会被下调）。"}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        AI 只能向上修正规则漏计，不会低于已验证的关键点命中，因此不会把错误答案判成高分。
        语音输入、口语化复述这类表达通常会被确定性匹配漏计，这正是 AI 主导计分的意义。
      </p>
    </div>
  );
}
