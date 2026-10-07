"use client";

import { useEffect, useMemo, useState } from "react";

import {
  fallbackInterviewSummary,
  type InterviewSummary,
  type InterviewSummaryInput,
} from "@/lib/interview/ai-coach";
import { requestInterviewSummary } from "@/lib/interview/ai-coach-client";
import type { InterviewReport } from "@/lib/interview/session";

export function AiInterviewSummaryCard({
  report,
  recommendedTopicNames,
}: {
  report: InterviewReport;
  recommendedTopicNames: readonly string[];
}) {
  const input = useMemo<InterviewSummaryInput>(() => ({
    overallScore: report.overallScore,
    answered: report.answered,
    skipped: report.skipped,
    categories: report.categories,
    weakestTopics: report.weakestTopics.map(({ topic, category, score }) => ({
      topic,
      category,
      score,
    })),
    missingPoints: report.missingPoints,
    recommendedTopics: recommendedTopicNames,
  }), [recommendedTopicNames, report]);

  const [summary, setSummary] = useState<InterviewSummary>(() =>
    fallbackInterviewSummary(input));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void requestInterviewSummary(input, fetch, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setSummary(value);
      })
      .catch(() => {
        // Abort/stale result intentionally ignored; deterministic fallback stays visible.
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [input]);

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">AI 辅助解读（不计分）</h2>
        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
          {loading
            ? "生成中 · 确定性总结已显示"
            : summary.source === "ai" ? "AI 总结" : "确定性总结"}
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">表现</p>
          <p className="mt-1 text-sm leading-6">{summary.strengths}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">改进</p>
          <p className="mt-1 text-sm leading-6">{summary.improvements}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">下一步</p>
          <p className="mt-1 text-sm leading-6">{summary.nextStep}</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        本卡只解释本场确定性报告，不新增分数，也不会修改 Mastery、Attempt 或复习时间。
      </p>
    </section>
  );
}
