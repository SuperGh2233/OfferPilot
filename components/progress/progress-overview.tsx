"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ALGORITHM_DEMO_CHANGED_EVENT,
  loadAlgorithmDemoData,
  type AlgorithmDemoData,
} from "@/lib/algorithm/demo-store";
import {
  KNOWLEDGE_DEMO_CHANGED_EVENT,
  loadKnowledgeDemoData,
  type KnowledgeDemoData,
} from "@/lib/knowledge/demo-store";
import {
  calculateCatalogProgress,
  calculateCyclePosition,
  calculateWeightedMastery,
} from "@/lib/progress/summary";
import {
  loadDemoProfile,
  PROFILE_DEMO_CHANGED_EVENT,
  type DemoProfile,
} from "@/lib/profile/demo-store";
import { useCloudTrainingSnapshot } from "@/lib/supabase/use-cloud-training";

export type ProgressAlgorithmProblem = {
  id: string;
  tags: readonly string[];
  importance: number;
};

export type ProgressKnowledgeQuestion = {
  id: string;
  topicId: string;
  category: string;
  questionType: "main" | "follow_up";
  importance: number;
  isCore6Weeks: boolean;
};

export type ProgressKnowledgeTopic = {
  id: string;
  name: string;
  category: string;
};

type Snapshot = {
  algorithm: AlgorithmDemoData;
  knowledge: KnowledgeDemoData;
  now: Date;
  profile: DemoProfile;
};

const CATEGORY_ORDER = ["Java基础", "Java集合", "Java并发", "JVM", "Spring", "MySQL", "Redis"];

export function ProgressOverview({
  algorithmProblems,
  demoMode,
  knowledgeQuestions,
  knowledgeTopics,
}: {
  algorithmProblems: readonly ProgressAlgorithmProblem[];
  demoMode: boolean;
  knowledgeQuestions: readonly ProgressKnowledgeQuestion[];
  knowledgeTopics: readonly ProgressKnowledgeTopic[];
}) {
  const [demoSnapshot, setDemoSnapshot] = useState<Snapshot | null>(null);
  const cloud = useCloudTrainingSnapshot(!demoMode);

  const refresh = useCallback(() => {
    if (!demoMode) return;
    const now = new Date();
    const algorithm = loadAlgorithmDemoData(window.localStorage, now);
    const profile = loadDemoProfile(window.localStorage, algorithm.planStartDate);
    setDemoSnapshot({
      algorithm,
      knowledge: loadKnowledgeDemoData(window.localStorage, now, profile.timeZone),
      now,
      profile,
    });
  }, [demoMode]);

  useEffect(() => {
    if (!demoMode) return;
    const initialRefresh = window.setTimeout(refresh, 0);
    window.addEventListener("storage", refresh);
    window.addEventListener(ALGORITHM_DEMO_CHANGED_EVENT, refresh);
    window.addEventListener(KNOWLEDGE_DEMO_CHANGED_EVENT, refresh);
    window.addEventListener(PROFILE_DEMO_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(ALGORITHM_DEMO_CHANGED_EVENT, refresh);
      window.removeEventListener(KNOWLEDGE_DEMO_CHANGED_EVENT, refresh);
      window.removeEventListener(PROFILE_DEMO_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [demoMode, refresh]);

  const cloudSnapshot = useMemo<Snapshot | null>(() => {
    if (!cloud.snapshot) return null;
    return {
      algorithm: cloud.snapshot.algorithm,
      knowledge: cloud.snapshot.knowledge,
      now: new Date(),
      profile: cloud.snapshot.profile,
    };
  }, [cloud.snapshot]);
  const snapshot = demoMode ? demoSnapshot : cloudSnapshot;

  if (cloud.error) {
    return <CloudError message={cloud.error} />;
  }
  if (!snapshot?.profile) {
    return <p className="mt-8 text-sm text-muted-foreground">正在计算训练进度…</p>;
  }

  const algorithmProgress = calculateCatalogProgress(
    algorithmProblems.map(({ id }) => id),
    snapshot.algorithm.states,
    snapshot.now,
  );
  const coreQuestions = knowledgeQuestions.filter(
    (question) => question.isCore6Weeks && question.questionType === "main",
  );
  const knowledgeProgress = calculateCatalogProgress(
    coreQuestions.map(({ id }) => id),
    snapshot.knowledge.states,
    snapshot.now,
  );
  const overallLearned = algorithmProgress.learned + knowledgeProgress.learned;
  const overallTotal = algorithmProgress.total + knowledgeProgress.total;
  const overallCompletion = Math.round((overallLearned / overallTotal) * 100);
  const cycle = calculateCyclePosition(
    snapshot.profile.planStartDate,
    snapshot.now,
    snapshot.profile.timeZone,
    snapshot.profile.pausePeriods ?? [],
  );

  const tags = [...new Set(algorithmProblems.flatMap((problem) => problem.tags))];
  const algorithmCategories = tags.map((tag) => {
    const problems = algorithmProblems.filter((problem) => problem.tags.includes(tag));
    return {
      label: tag,
      mastery: calculateWeightedMastery(
        problems.map((problem) => ({ id: problem.id, weight: problem.importance })),
        snapshot.algorithm.states,
      ),
      learned: problems.filter((problem) => snapshot.algorithm.states[problem.id]?.attemptCount > 0).length,
      total: problems.length,
    };
  }).sort((left, right) =>
    Number(right.learned > 0) - Number(left.learned > 0)
    || left.mastery - right.mastery
    || left.label.localeCompare(right.label, "zh-CN"),
  );

  const knowledgeCategories = CATEGORY_ORDER.map((category) => {
    const questions = coreQuestions.filter((question) => question.category === category);
    return {
      label: category,
      mastery: calculateWeightedMastery(
        questions.map((question) => ({ id: question.id, weight: question.importance })),
        snapshot.knowledge.states,
      ),
      learned: questions.filter((question) => snapshot.knowledge.states[question.id]?.attemptCount > 0).length,
      total: questions.length,
    };
  });

  const questionsByTopic = new Map<string, ProgressKnowledgeQuestion[]>();
  for (const question of knowledgeQuestions) {
    const rows = questionsByTopic.get(question.topicId) ?? [];
    rows.push(question);
    questionsByTopic.set(question.topicId, rows);
  }
  const weakTopics = knowledgeTopics.map((topic) => {
    const questions = questionsByTopic.get(topic.id) ?? [];
    const attempted = questions.filter(
      (question) => snapshot.knowledge.states[question.id]?.attemptCount > 0,
    ).length;
    const due = questions.filter((question) => {
      const state = snapshot.knowledge.states[question.id];
      return state
        && state.status !== "mastered"
        && new Date(state.nextReviewAt).getTime() <= snapshot.now.getTime();
    }).length;
    return {
      ...topic,
      attempted,
      due,
      mastery: calculateWeightedMastery(
        questions.map((question) => ({
          id: question.id,
          weight: question.importance * (question.questionType === "follow_up" ? 0.5 : 1),
        })),
        snapshot.knowledge.states,
      ),
    };
  }).filter((topic) => topic.attempted > 0)
    .sort((left, right) => left.mastery - right.mastery || right.due - left.due)
    .slice(0, 10);

  return (
    <div className="mt-8 flex flex-col gap-6">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              第一训练周期 · Day {cycle.day} / 42
            </p>
            <h2 className="mt-3 text-4xl font-semibold">{overallCompletion}%</h2>
            <p className="mt-2 text-sm text-slate-300">
              已开始 {overallLearned}/{overallTotal} 个核心训练目标
            </p>
          </div>
          <p className="max-w-sm text-sm leading-6 text-slate-400">
            这里统计 Hot 100 与核心 120 的学习覆盖；Mastery 和待复习单独展示，不用签到或积分稀释训练信号。
          </p>
        </div>
        <ProgressBar value={overallCompletion} dark />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <CatalogCard description="LeetCode Hot 100" progress={algorithmProgress} title="Algorithm" />
        <CatalogCard description="六周核心主问题" progress={knowledgeProgress} title="Knowledge" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <CategoryCard rows={algorithmCategories} title="算法分类 Mastery" />
        <CategoryCard rows={knowledgeCategories} title="八股分类 Mastery" />
      </section>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">薄弱 Topic Top 10</h2>
            <p className="mt-1 text-sm text-muted-foreground">只显示已经开始训练的 Topic。</p>
          </div>
          <Link className="text-sm font-medium underline-offset-4 hover:underline" href="/knowledge">
            去复习 →
          </Link>
        </div>
        {weakTopics.length > 0 ? (
          <div className="mt-4 divide-y">
            {weakTopics.map((topic, index) => (
              <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3" key={topic.id}>
                <span className="text-sm text-muted-foreground">{index + 1}</span>
                <div>
                  <p className="text-sm font-medium">{topic.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {topic.category} · 已学习 {topic.attempted}{topic.due > 0 ? ` · ${topic.due} 道到期` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">{Math.round(topic.mastery)}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            完成一次八股 Learn 或 Recall 后，这里会出现真实薄弱 Topic。
          </p>
        )}
      </section>
    </div>
  );
}

function CloudError({ message }: { message: string }) {
  return (
    <section aria-live="assertive" className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
      <h2 className="text-xl font-semibold">云端进度读取失败</h2>
      <p className="mt-2 text-sm">{message}</p>
    </section>
  );
}

function ProgressBar({ dark = false, value }: { dark?: boolean; value: number }) {
  return (
    <div className={`mt-5 h-2 overflow-hidden rounded-full ${dark ? "bg-slate-800" : "bg-muted"}`}>
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function CatalogCard({
  description,
  progress,
  title,
}: {
  description: string;
  progress: ReturnType<typeof calculateCatalogProgress>;
  title: string;
}) {
  return (
    <article className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="text-2xl font-semibold">{progress.completion}%</span>
      </div>
      <ProgressBar value={progress.completion} />
      <div className="mt-5 grid grid-cols-4 gap-2 text-center">
        <Count label="已学习" value={progress.learned} />
        <Count label="已掌握" value={progress.mastered} />
        <Count label="待复习" value={progress.due} />
        <Count label="未学习" value={progress.unlearned} />
      </div>
    </article>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted px-2 py-3">
      <p className="font-semibold">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{label}</p>
    </div>
  );
}

function CategoryCard({
  rows,
  title,
}: {
  rows: readonly { label: string; learned: number; mastery: number; total: number }[];
  title: string;
}) {
  return (
    <article className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 max-h-[30rem] space-y-4 overflow-y-auto pr-2">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(row.mastery)}% · {row.learned}/{row.total}
              </span>
            </div>
            <ProgressBar value={row.mastery} />
          </div>
        ))}
      </div>
    </article>
  );
}
