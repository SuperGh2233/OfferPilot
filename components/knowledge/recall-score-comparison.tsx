/**
 * 并列展示两个口径的分数，避免用户误以为「AI 复核后分数没生效」。
 *
 * 加权覆盖率是确定性关键词匹配的结果，计入 Mastery 与下次复习；
 * 语义覆盖是 AI 复核的结果，只用于解释，不改变 Mastery。
 * 两者口径不同，数值不一致是正常现象，必须在界面上说清楚。
 */
export function RecallScoreComparison({
  coverageScore,
  semanticScore,
  verdictLabel,
}: {
  coverageScore: number | null | undefined;
  semanticScore: number;
  verdictLabel?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        两个分数口径不同，不必一致
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-xs text-emerald-800 dark:text-emerald-300">加权覆盖率 · 确定性匹配</p>
          <p className="mt-1 text-xl font-semibold text-emerald-900 dark:text-emerald-200">
            {`${coverageScore ?? 0}%`}
          </p>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
            已计入 Mastery 与下次复习
          </p>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40">
          <p className="text-xs text-sky-800 dark:text-sky-300">
            语义覆盖 · AI 复核{verdictLabel ? ` · ${verdictLabel}` : ""}
          </p>
          <p className="mt-1 text-xl font-semibold text-sky-900 dark:text-sky-200">{`${semanticScore}%`}</p>
          <p className="mt-1 text-xs text-sky-800/80 dark:text-sky-300/80">仅供参考，不改变 Mastery</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        加权覆盖率只匹配关键点原文与已登记别名，口语化或同义表达会被漏计；语义复核按含义判断，因此通常更高。
        计分始终以加权覆盖率为准，语义复核只用来指出你实际理解到哪一步。
      </p>
    </div>
  );
}
