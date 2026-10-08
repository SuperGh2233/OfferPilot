import Link from "next/link";
import type { getDailyTrainingFocus } from "@/lib/progress/daily-focus";

export function DailyTrainingFocus({ focus, paused }: {
  focus: ReturnType<typeof getDailyTrainingFocus>;
  paused: boolean;
}) {
  const next = focus.next;
  const title = paused ? "休息期间可继续补欠账"
    : focus.dayComplete ? "今日计划已完成"
    : focus.remaining > 0 ? `今天还剩 ${focus.remaining} 项`
    : "今天暂无计划任务";
  const label = next?.source === "backlog" ? "继续补欠账"
    : next?.source === "due" ? "继续到期复习"
    : paused ? "继续原有任务"
    : next?.inProgress ? "继续进行中的训练" : "开始下一项训练";
  return (
    <section aria-label="今日训练行动" className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {focus.dayComplete
              ? `已完成算法 ${focus.algorithmCompleted} 项、八股 ${focus.knowledgeCompleted} 项。${next ? "仍可继续处理欠账或到期复习。" : "可以结束今天的计划训练。"}`
              : paused ? "暂停前的任务与逾期复习仍可完成，休息日不推进训练周期。"
              : focus.remaining > 0 ? `剩余今日计划参考用时约 ${focus.estimatedMinutes} 分钟，不含历史欠账。`
              : next ? "仍有往日任务或到期复习，可按需继续。" : "到期复习出现后会进入训练队列。"}
          </p>
        </div>
        {next ? (
          <Link className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80" href={next.href}>
            {label} · {next.kind === "algorithm" ? "算法" : "八股"}
          </Link>
        ) : focus.remaining > 0 ? <div className="flex gap-3 text-sm underline"><Link href="/algorithm?filter=today">查看算法任务</Link><Link href="/knowledge">查看八股任务</Link></div> : null}
      </div>
      {!paused && focus.remaining > 0 ? (
        <details className="mt-3 text-xs leading-5 text-muted-foreground">
          <summary className="cursor-pointer">参考用时如何估算</summary>
          <p className="mt-1">算法新学/复习按 25/15 分钟，八股新学/复习按 8/5 分钟估算；这是安排时间的参考预算，实际用时因题目和熟悉程度而异。</p>
        </details>
      ) : null}
    </section>
  );
}
