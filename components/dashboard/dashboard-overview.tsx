"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ALGORITHM_DEMO_CHANGED_EVENT,
  ensureTodayAlgorithmTasks,
  getAlgorithmTrainingDateKey,
  loadAlgorithmDemoData,
  saveAlgorithmDemoData,
  type AlgorithmDemoData,
  type LocalAlgorithmTask,
} from "@/lib/algorithm/demo-store";
import {
  ensureTodayKnowledgeTasks,
  KNOWLEDGE_DEMO_CHANGED_EVENT,
  loadKnowledgeDemoData,
  saveKnowledgeDemoData,
  type KnowledgeDemoData,
  type LocalKnowledgeTask,
} from "@/lib/knowledge/demo-store";
import { calculateKnowledgeTopicMastery } from "@/lib/mastery/knowledge";
import {
  aggregateAlgorithmWeaknesses,
  type AlgorithmPlannerProblem,
} from "@/lib/planner/algorithm";
import type { KnowledgePlannerQuestion } from "@/lib/planner/knowledge";
import {
  loadDemoProfile,
  PROFILE_DEMO_CHANGED_EVENT,
  type DemoProfile,
} from "@/lib/profile/demo-store";
import {
  calculateCyclePosition,
  calculateTrainingBacklog,
  calculateTrainingStreak,
  calculateWeeklyCompletion,
  flattenDailyTasks,
} from "@/lib/progress/summary";
import { useCloudTrainingSnapshot } from "@/lib/supabase/use-cloud-training";

type DashboardKnowledgeQuestion = KnowledgePlannerQuestion & {
  topicId: string;
};

type DashboardTopic = {
  id: string;
  name: string;
  category: string;
};

type Snapshot = {
  algorithmData: AlgorithmDemoData;
  algorithmTasks: LocalAlgorithmTask[];
  knowledgeData: KnowledgeDemoData;
  knowledgeTasks: LocalKnowledgeTask[];
  now: Date;
  profile: DemoProfile;
};

const MISTAKE_LABELS: Readonly<Record<string, string>> = {
  no_idea: "没有思路",
  wrong_idea: "思路错误",
  boundary: "边界条件",
  pointer: "指针操作",
  state: "状态设计",
  java_syntax: "Java 语法",
  java_api: "Java API",
  data_structure: "数据结构",
  complexity: "复杂度",
  careless: "粗心",
};

function taskCounts<T extends { status: string; taskType: string }>(
  tasks: readonly T[],
  newTaskType: string,
) {
  const completed = tasks.filter((task) => task.status === "completed").length;
  return {
    completed,
    newCount: tasks.filter((task) => task.taskType === newTaskType).length,
    reviewCount: tasks.filter((task) => task.taskType !== newTaskType).length,
    remaining: tasks.length - completed,
    total: tasks.length,
  };
}

export function DashboardOverview({
  algorithmProblems,
  demoMode,
  knowledgeQuestions,
  topics,
}: {
  algorithmProblems: readonly AlgorithmPlannerProblem[];
  demoMode: boolean;
  knowledgeQuestions: readonly DashboardKnowledgeQuestion[];
  topics: readonly DashboardTopic[];
}) {
  const [demoSnapshot, setDemoSnapshot] = useState<Snapshot | null>(null);
  const cloud = useCloudTrainingSnapshot(!demoMode);

  const refresh = useCallback(() => {
    if (!demoMode) return;
    const now = new Date();
    const algorithmLoaded = loadAlgorithmDemoData(window.localStorage, now);
    const profile = loadDemoProfile(window.localStorage, algorithmLoaded.planStartDate);
    const algorithmEnsured = ensureTodayAlgorithmTasks(algorithmLoaded, algorithmProblems, now, {
      newCount: profile.dailyNewAlgorithmCount,
      reviewCount: profile.dailyReviewAlgorithmCount,
      timeZone: profile.timeZone,
    });
    if (algorithmEnsured.data !== algorithmLoaded) {
      saveAlgorithmDemoData(window.localStorage, algorithmEnsured.data);
    }

    const knowledgeLoaded = loadKnowledgeDemoData(window.localStorage, now, profile.timeZone);
    const knowledgeEnsured = ensureTodayKnowledgeTasks(knowledgeLoaded, knowledgeQuestions, now, {
      newCount: profile.dailyNewKnowledgeCount,
      reviewCount: profile.dailyReviewKnowledgeCount,
      timeZone: profile.timeZone,
    });
    if (knowledgeEnsured.data !== knowledgeLoaded) {
      saveKnowledgeDemoData(window.localStorage, knowledgeEnsured.data);
    }

    setDemoSnapshot({
      algorithmData: algorithmEnsured.data,
      algorithmTasks: algorithmEnsured.tasks,
      knowledgeData: knowledgeEnsured.data,
      knowledgeTasks: knowledgeEnsured.tasks,
      now,
      profile,
    });
  }, [algorithmProblems, demoMode, knowledgeQuestions]);

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
    const now = new Date();
    const date = getAlgorithmTrainingDateKey(now, cloud.snapshot.profile.timeZone);
    return {
      algorithmData: cloud.snapshot.algorithm,
      algorithmTasks: cloud.snapshot.algorithm.dailyTasks[date] ?? [],
      knowledgeData: cloud.snapshot.knowledge,
      knowledgeTasks: cloud.snapshot.knowledge.dailyTasks[date] ?? [],
      now,
      profile: cloud.snapshot.profile,
    };
  }, [cloud.snapshot]);
  const snapshot = demoMode ? demoSnapshot : cloudSnapshot;

  if (cloud.error) {
    return (
      <section aria-live="assertive" className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
        <h2 className="text-xl font-semibold">训练数据库读取失败</h2>
        <p className="mt-2 text-sm leading-6">{cloud.error}</p>
      </section>
    );
  }

  if (!snapshot?.profile) {
    return <p className="mt-8 text-sm text-muted-foreground">正在汇总今天的训练…</p>;
  }

  const algorithmCounts = taskCounts(snapshot.algorithmTasks, "new");
  const knowledgeCounts = taskCounts(snapshot.knowledgeTasks, "new");
  const algorithmStates = Object.values(snapshot.algorithmData.states);
  const algorithmMastery = algorithmStates.length === 0
    ? null
    : Math.round(
        algorithmStates.reduce((sum, state) => sum + state.mastery, 0) /
          algorithmStates.length,
      );
  const allTasks = [
    ...flattenDailyTasks(snapshot.algorithmData.dailyTasks),
    ...flattenDailyTasks(snapshot.knowledgeData.dailyTasks),
  ];
  const cycle = calculateCyclePosition(
    snapshot.profile.planStartDate,
    snapshot.now,
    snapshot.profile.timeZone,
  );
  const weekly = calculateWeeklyCompletion({
    planStartDate: snapshot.profile.planStartDate,
    tasks: allTasks,
    today: snapshot.now,
    timeZone: snapshot.profile.timeZone,
  });
  const streak = calculateTrainingStreak(allTasks, snapshot.now, snapshot.profile.timeZone);
  const algorithmWeaknesses = aggregateAlgorithmWeaknesses({
    attempts: snapshot.algorithmData.attempts.map((attempt) => ({
      mistakeTags: attempt.mistakeTags,
      aiWeaknessTags: attempt.aiAnalysis?.weaknessTags,
    })),
    limit: 4,
  });
  const questionsByTopic = new Map<string, DashboardKnowledgeQuestion[]>();
  for (const question of knowledgeQuestions) {
    const rows = questionsByTopic.get(question.topicId) ?? [];
    rows.push(question);
    questionsByTopic.set(question.topicId, rows);
  }
  const knowledgeWeaknesses = topics
    .map((topic) => {
      const questions = questionsByTopic.get(topic.id) ?? [];
      const attempted = questions.some(
        (question) => snapshot.knowledgeData.states[question.id]?.attemptCount > 0,
      );
      const mastery = calculateKnowledgeTopicMastery(questions.map((question) => ({
        importance: question.importance,
        mastery: snapshot.knowledgeData.states[question.id]?.mastery ?? null,
        questionType: question.questionType,
      })));
      return { ...topic, attempted, mastery };
    })
    .filter((topic) => topic.attempted)
    .sort((left, right) => left.mastery - right.mastery || left.name.localeCompare(right.name, "zh-CN"))
    .slice(0, 4);
  const remaining = algorithmCounts.remaining + knowledgeCounts.remaining;
  const algorithmLearnedCount = algorithmStates.filter((state) => state.attemptCount > 0).length;
  const coreKnowledgeQuestions = knowledgeQuestions.filter((question) => question.isCore6Weeks);
  const knowledgeLearnedCount = coreKnowledgeQuestions.filter(
    (question) => snapshot.knowledgeData.states[question.id]?.attemptCount > 0,
  ).length;
  const backlog = calculateTrainingBacklog({
    algorithmStates: Object.values(snapshot.algorithmData.states),
    knowledgeStates: Object.values(snapshot.knowledgeData.states),
    algorithmDailyTasks: snapshot.algorithmData.dailyTasks,
    knowledgeDailyTasks: snapshot.knowledgeData.dailyTasks,
    planStartDate: snapshot.profile.planStartDate,
    today: snapshot.now,
    timeZone: snapshot.profile.timeZone,
    dailyNewAlgorithmCount: snapshot.profile.dailyNewAlgorithmCount,
    dailyReviewAlgorithmCount: snapshot.profile.dailyReviewAlgorithmCount,
    dailyNewKnowledgeCount: snapshot.profile.dailyNewKnowledgeCount,
    dailyReviewKnowledgeCount: snapshot.profile.dailyReviewKnowledgeCount,
    algorithmLearnedCount,
    knowledgeLearnedCount,
    algorithmCatalogSize: algorithmProblems.length,
    knowledgeCatalogSize: coreKnowledgeQuestions.length,
  });
  const hasBacklog = Object.values(backlog).some((count) => count > 0);

  return (
    <div className="mt-8 flex flex-col gap-6">
      <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              第一训练周期 · {cycle.isFirstCycleComplete ? "持续复习" : `第 ${cycle.week} 周`}
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              Day {cycle.day}<span className="text-xl text-slate-400"> / 42</span>
            </h2>
            {snapshot.profile.displayName ? (
              <p className="mt-2 text-sm font-medium text-emerald-300">{snapshot.profile.displayName}，今天继续稳步推进。</p>
            ) : null}
            <p className="mt-3 text-sm text-slate-300">
              今天还剩 {remaining} 项；第一周期结束后仍会继续生成到期复习。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-5 text-sm sm:text-right">
            <Metric label="本周完成" value={`${weekly.percentage}%`} />
            <Metric label="连续训练" value={`${streak} 天`} />
          </div>
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${cycle.progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          第一周期进度 {cycle.progress}% · 本周已完成 {weekly.completed}/{weekly.total} 个已生成任务
        </p>
      </section>

      {hasBacklog ? (
        <section
          aria-live="polite"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40"
        >
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
            有待补齐的训练
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <BacklogMetric label="漏训天数" value={`${backlog.missedTrainingDays} 天`} />
            <BacklogMetric
              label="新学进度缺口"
              value={`算法 ${backlog.algorithmLearningGap} · 八股 ${backlog.knowledgeLearningGap}`}
            />
            <BacklogMetric
              label="逾期复习"
              value={`算法 ${backlog.algorithmOverdueReviews} · 八股 ${backlog.knowledgeOverdueReviews}`}
            />
          </div>
          {backlog.algorithmLeftoverTasks + backlog.knowledgeLeftoverTasks > 0 ? (
            <p className="mt-3 text-sm leading-6 text-amber-900 dark:text-amber-200">
              另有 {backlog.algorithmLeftoverTasks + backlog.knowledgeLeftoverTasks} 项往日已生成但未完成的任务。
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-5 text-amber-800/80 dark:text-amber-300/80">
            逾期复习可在下方入口查看全部到期题；新学进度缺口是累计数量，不对应某天固定的旧题，可继续学习核心题逐步补齐。今日复习任务最多为配置数量的 3 倍。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {backlog.algorithmOverdueReviews > 0 ? <Link
              className="inline-flex h-9 items-center justify-center rounded-lg bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500"
              href="/algorithm?filter=due#problems"
            >
              去清算法复习
            </Link> : null}
            {backlog.knowledgeOverdueReviews > 0 ? <Link
              className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-400 px-4 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
              href="/knowledge#due"
            >
              去清八股复习
            </Link> : null}
            {backlog.algorithmLearningGap > 0 ? <Link
              className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-400 px-4 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
              href="/algorithm?filter=unlearned#problems"
            >
              去补算法新学
            </Link> : null}
            {backlog.knowledgeLearningGap > 0 ? <Link
              className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-400 px-4 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
              href="/knowledge#new"
            >
              去补八股新学
            </Link> : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <TrainingCard
          accent="bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
          counts={algorithmCounts}
          description="Hot 100 计时、反馈与间隔复习"
          detail={algorithmMastery === null
            ? "当前 mastery：尚未训练"
            : `当前 mastery：${algorithmMastery}%（已训练题平均）`}
          href="/algorithm"
          labels={["新题", "复习 / 强化"]}
          title="Algorithm"
        />
        <TrainingCard
          accent="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          counts={knowledgeCounts}
          description="核心八股学习、主动回忆与关键词覆盖"
          href="/knowledge"
          labels={["新学", "复习"]}
          title="Knowledge"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <WeaknessCard title="Algorithm 薄弱点">
          {algorithmWeaknesses.length > 0 ? (
            algorithmWeaknesses.map((item) => (
              <div className="flex items-center justify-between border-b py-2 last:border-0" key={item.tag}>
                <span className="text-sm font-medium">{MISTAKE_LABELS[item.tag] ?? item.tag}</span>
                <span className="text-xs text-muted-foreground">出现 {item.count} 次</span>
              </div>
            ))
          ) : (
            <EmptyWeakness>完成带错误标签的算法训练后显示。</EmptyWeakness>
          )}
        </WeaknessCard>
        <WeaknessCard title="Knowledge 薄弱 Topic">
          {knowledgeWeaknesses.length > 0 ? (
            knowledgeWeaknesses.map((topic) => (
              <div className="flex items-center justify-between border-b py-2 last:border-0" key={topic.id}>
                <div>
                  <p className="text-sm font-medium">{topic.name}</p>
                  <p className="text-xs text-muted-foreground">{topic.category}</p>
                </div>
                <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">{Math.round(topic.mastery)}%</span>
              </div>
            ))
          ) : (
            <EmptyWeakness>完成八股 Learn 或 Recall 后显示。</EmptyWeakness>
          )}
        </WeaknessCard>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function BacklogMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white/60 p-3 dark:border-amber-900 dark:bg-black/10">
      <p className="text-xs text-amber-800/80 dark:text-amber-300/80">{label}</p>
      <p className="mt-1 text-sm font-semibold text-amber-950 dark:text-amber-100">{value}</p>
    </div>
  );
}

function TrainingCard({
  accent,
  counts,
  description,
  detail,
  href,
  labels,
  title,
}: {
  accent: string;
  counts: { completed: number; newCount: number; remaining: number; reviewCount: number; total: number };
  description: string;
  detail?: string;
  href: string;
  labels: readonly [string, string];
  title: string;
}) {
  return (
    <article className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${accent}`}>
          {counts.completed}/{counts.total} 完成
        </span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        <SmallMetric label={labels[0]} value={counts.newCount} />
        <SmallMetric label={labels[1]} value={counts.reviewCount} />
        <SmallMetric label="剩余" value={counts.remaining} />
      </div>
      {detail ? <p className="mt-3 text-xs text-muted-foreground">{detail}</p> : null}
      <Link
        className="mt-5 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        href={href}
      >
        进入训练
      </Link>
    </article>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted px-2 py-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function WeaknessCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <article className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function EmptyWeakness({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-muted-foreground">{children}</p>;
}
