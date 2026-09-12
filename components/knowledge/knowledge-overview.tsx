"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ALGORITHM_DEMO_TIME_ZONE,
  calculateAlgorithmCurrentWeek,
  getAlgorithmDemoDateKey,
} from "@/lib/algorithm/demo-store";
import type { KnowledgeCatalogTopic } from "@/lib/knowledge/catalog";
import {
  ensureTodayKnowledgeTasks,
  KNOWLEDGE_DEMO_CHANGED_EVENT,
  loadKnowledgeDemoData,
  saveKnowledgeDemoData,
  type KnowledgeDemoData,
  type LocalKnowledgeTask,
} from "@/lib/knowledge/demo-store";
import { calculateKnowledgeTopicMastery } from "@/lib/mastery/knowledge";
import type { KnowledgePlannerQuestion } from "@/lib/planner/knowledge";
import {
  loadDemoProfile,
  PROFILE_DEMO_CHANGED_EVENT,
} from "@/lib/profile/demo-store";
import { useCloudTrainingSnapshot } from "@/lib/supabase/use-cloud-training";

export type KnowledgeOverviewQuestion = {
  id: string;
  topicId: string;
  question: string;
  questionType: "main" | "follow_up";
  importance: number;
  isCore6Weeks: boolean;
};

type Snapshot = {
  data: KnowledgeDemoData;
  tasks: LocalKnowledgeTask[];
  currentWeek: number;
  date: string;
  now: number;
  timeZone: string;
};

const CATEGORY_ORDER = ["Java基础", "Java集合", "Java并发", "JVM", "Spring", "MySQL", "Redis"];

function isDue(data: KnowledgeDemoData | null, questionId: string, now: number) {
  const state = data?.states[questionId];
  return state !== undefined && new Date(state.nextReviewAt).getTime() <= now;
}

function formatReview(value: string | undefined, now: number, timeZone: string) {
  if (!value) return "尚未学习";
  const date = new Date(value);
  if (date.getTime() <= now) return "已到期";
  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "short",
    timeZone,
  }).format(date);
}

export function KnowledgeOverview({
  demoMode,
  plannerQuestions,
  questions,
  topics,
}: {
  demoMode: boolean;
  plannerQuestions: readonly KnowledgePlannerQuestion[];
  questions: readonly KnowledgeOverviewQuestion[];
  topics: readonly KnowledgeCatalogTopic[];
}) {
  const categories = useMemo(
    () => [...new Set(topics.map((topic) => topic.category))].sort((left, right) => {
      const leftIndex = CATEGORY_ORDER.indexOf(left);
      const rightIndex = CATEGORY_ORDER.indexOf(right);
      return (leftIndex === -1 ? CATEGORY_ORDER.length : leftIndex)
        - (rightIndex === -1 ? CATEGORY_ORDER.length : rightIndex);
    }),
    [topics],
  );
  const [category, setCategory] = useState(categories[0] ?? "全部");
  const [demoSnapshot, setDemoSnapshot] = useState<Snapshot | null>(null);
  const cloud = useCloudTrainingSnapshot(!demoMode);

  const refresh = useCallback(() => {
    if (!demoMode) return;
    const now = new Date();
    const loaded = loadKnowledgeDemoData(window.localStorage, now);
    const profile = loadDemoProfile(window.localStorage, loaded.planStartDate);
    const ensured = ensureTodayKnowledgeTasks(loaded, plannerQuestions, now, {
      newCount: profile.dailyNewKnowledgeCount,
      reviewCount: profile.dailyReviewKnowledgeCount,
      timeZone: profile.timeZone,
    });
    if (ensured.data !== loaded) saveKnowledgeDemoData(window.localStorage, ensured.data);
    setDemoSnapshot({
      data: ensured.data,
      tasks: ensured.tasks,
      currentWeek: ensured.currentWeek,
      date: ensured.date,
      now: now.getTime(),
      timeZone: profile.timeZone,
    });
  }, [demoMode, plannerQuestions]);

  useEffect(() => {
    if (!demoMode) return;
    const initialRefresh = window.setTimeout(refresh, 0);
    window.addEventListener("storage", refresh);
    window.addEventListener(KNOWLEDGE_DEMO_CHANGED_EVENT, refresh);
    window.addEventListener(PROFILE_DEMO_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(KNOWLEDGE_DEMO_CHANGED_EVENT, refresh);
      window.removeEventListener(PROFILE_DEMO_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [demoMode, refresh]);

  const cloudSnapshot = useMemo<Snapshot | null>(() => {
    if (!cloud.snapshot) return null;
    const now = new Date();
    const date = getAlgorithmDemoDateKey(now, cloud.snapshot.profile.timeZone);
    return {
      data: cloud.snapshot.knowledge,
      tasks: cloud.snapshot.knowledge.dailyTasks[date] ?? [],
      currentWeek: calculateAlgorithmCurrentWeek(
        cloud.snapshot.profile.planStartDate,
        now,
        cloud.snapshot.profile.timeZone,
      ),
      date,
      now: now.getTime(),
      timeZone: cloud.snapshot.profile.timeZone,
    };
  }, [cloud.snapshot]);
  const snapshot = demoMode ? demoSnapshot : cloudSnapshot;

  const data = snapshot?.data ?? null;
  const now = snapshot?.now ?? 0;
  const questionsByTopic = useMemo(() => {
    const result = new Map<string, KnowledgeOverviewQuestion[]>();
    for (const question of questions) {
      const rows = result.get(question.topicId) ?? [];
      rows.push(question);
      result.set(question.topicId, rows);
    }
    return result;
  }, [questions]);
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const visibleTopics = category === "全部"
    ? topics
    : topics.filter((topic) => topic.category === category);
  const learnedCount = questions.filter((question) =>
    question.questionType === "main" && (data?.states[question.id]?.attemptCount ?? 0) > 0,
  ).length;
  const masteredCount = Object.values(data?.states ?? {}).filter(
    (state) => state.status === "mastered",
  ).length;
  const dueCount = questions.filter((question) => isDue(data, question.id, now)).length;
  const completedToday = snapshot?.tasks.filter((task) => task.status === "completed").length ?? 0;

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link className="text-sm font-medium text-muted-foreground hover:text-foreground" href="/dashboard">
              ← Dashboard
            </Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">八股主动回忆</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              先学习关键结论，再用自己的话回忆；系统只做稳定、可解释的关键词覆盖检测。
            </p>
          </div>
          <span className="w-fit rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
            {demoMode ? "浏览器 Demo · 仅此浏览器" : "持久数据库"}
          </span>
        </header>

        <section className={`rounded-2xl border px-5 py-4 text-sm ${demoMode ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200" : cloud.error ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300" : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"}`}>
          {cloud.error ?? `第 ${snapshot?.currentWeek ?? 1} 周 · ${snapshot?.date ?? "正在同步"} · 今日完成 ${completedToday}/${snapshot?.tasks.length ?? 0}`}
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Topic" value={topics.length} detail="完整八股目录" />
          <Stat label="已学习主问题" value={learnedCount} detail="共 394 道主问题" />
          <Stat label="已掌握" value={masteredCount} detail="至少一次 Recall" />
          <Stat label="待复习" value={dueCount} detail="next review 已到期" />
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">今日 Knowledge</h2>
              <p className="mt-1 text-sm text-muted-foreground">默认 3 个新学 + 3 个到期复习</p>
            </div>
            <span className="text-sm text-muted-foreground">{snapshot?.tasks.length ?? 0} 项</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(snapshot?.tasks.length ?? 0) === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                今天没有待完成任务。到期复习出现后会自动加入这里。
              </p>
            ) : (snapshot?.tasks ?? []).map((task) => {
              const question = questionById.get(task.questionId);
              if (!question) return null;
              return (
                <Link
                  className="rounded-xl border bg-card p-4 transition hover:border-ring hover:shadow-sm"
                  href={`/knowledge/${question.id}`}
                  key={question.id}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">{task.taskType === "new" ? "新学" : "复习"}</span>
                    <span className={task.status === "completed" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
                      {task.status === "completed" ? "已完成" : "待完成"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium leading-6">{question.question}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex flex-wrap gap-2" aria-label="八股分类">
            {["全部", ...categories].map((item) => (
              <button
                aria-pressed={category === item}
                className={`rounded-full px-3 py-2 text-sm font-medium ${category === item ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                key={item}
                onClick={() => setCategory(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visibleTopics.map((topic) => {
              const topicQuestions = questionsByTopic.get(topic.id) ?? [];
              return (
                <TopicCard
                  data={data}
                  key={topic.id}
                  now={now}
                  questions={topicQuestions}
                  timeZone={snapshot?.timeZone ?? ALGORITHM_DEMO_TIME_ZONE}
                  topic={topic}
                />
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function TopicCard({
  data,
  now,
  questions,
  timeZone,
  topic,
}: {
  data: KnowledgeDemoData | null;
  now: number;
  questions: readonly KnowledgeOverviewQuestion[];
  timeZone: string;
  topic: KnowledgeCatalogTopic;
}) {
  const mainQuestions = questions.filter(({ questionType }) => questionType === "main");
  const learned = mainQuestions.filter((question) => data?.states[question.id]).length;
  const due = questions.filter((question) => isDue(data, question.id, now)).length;
  const mastery = calculateKnowledgeTopicMastery(questions.map((question) => ({
    mastery: data?.states[question.id]?.mastery ?? null,
    importance: question.importance,
    questionType: question.questionType,
  })));

  return (
    <details className="group rounded-2xl border bg-card p-5 shadow-sm">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{topic.category}</p>
            <h2 className="mt-1 font-semibold">{topic.name}</h2>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{Math.round(mastery)}%</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${mastery}%` }} />
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>{learned}/{mainQuestions.length} 已学习</span>
          <span>{due > 0 ? `${due} 道待复习` : "查看问题 ↓"}</span>
        </div>
      </summary>
      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto border-t pt-4">
        {mainQuestions.map((question) => (
          <Link
            className="flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted"
            href={`/knowledge/${question.id}`}
            key={question.id}
            prefetch={false}
          >
            <span className="leading-5">{question.question}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatReview(
                data?.states[question.id]?.nextReviewAt,
                now,
                timeZone,
              )}
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}
