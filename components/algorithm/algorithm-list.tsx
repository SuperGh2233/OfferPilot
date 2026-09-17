"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ALGORITHM_DEMO_CHANGED_EVENT,
  ALGORITHM_DEMO_USER_ID,
  calculateAlgorithmCurrentWeek,
  ensureTodayAlgorithmTasks,
  getAlgorithmTrainingDateKey,
  loadAlgorithmDemoData,
  saveAlgorithmDemoData,
  type AlgorithmDemoData,
  type LocalAlgorithmTask,
  type StorageLike,
} from "@/lib/algorithm/demo-store";
import {
  importCompletedAlgorithmProblems,
  parseAlgorithmImport,
} from "@/lib/algorithm/import-progress";
import {
  toAlgorithmPlannerProblem,
  type AlgorithmCatalogProblem,
} from "@/lib/algorithm/catalog";
import {
  loadDemoProfile,
  PROFILE_DEMO_CHANGED_EVENT,
} from "@/lib/profile/demo-store";
import { getTrainingStatusPresentation } from "@/lib/ui/training-status";
import { isReviewDue } from "@/lib/progress/summary";
import { useCloudTrainingSnapshot } from "@/lib/supabase/use-cloud-training";
import { importCloudAlgorithms } from "@/lib/supabase/training-client";

type AlgorithmFilter =
  | "all"
  | "today"
  | "due"
  | "unlearned"
  | "mastered"
  | "weak";

type DemoSnapshot = {
  data: AlgorithmDemoData;
  tasks: LocalAlgorithmTask[];
  currentWeek: number;
  date: string;
  now: number;
  timeZone: string;
};

type AlgorithmListProps = {
  demoMode: boolean;
  initialFilter: "all" | "due" | "unlearned";
  problems: readonly AlgorithmCatalogProblem[];
  tags: readonly string[];
};

const FILTERS: readonly { key: AlgorithmFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "today", label: "今日任务" },
  { key: "due", label: "待复习" },
  { key: "unlearned", label: "未学习" },
  { key: "mastered", label: "已掌握" },
  { key: "weak", label: "薄弱" },
];

const DIFFICULTY_LABELS = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
} as const;

const DIFFICULTY_STYLES = {
  easy: "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300",
  hard: "bg-rose-100 text-rose-800 ring-rose-600/20 dark:bg-rose-950/60 dark:text-rose-300",
} as const;

function getStorage(): StorageLike {
  return window.localStorage;
}

function getState(data: AlgorithmDemoData | null, problemId: string) {
  return data?.states[problemId];
}

function hasAttempted(data: AlgorithmDemoData | null, problemId: string) {
  const state = getState(data, problemId);
  return state !== undefined && state.attemptCount > 0;
}

function isAlgorithmDue(
  data: AlgorithmDemoData | null,
  problemId: string,
  now: number,
) {
  const state = getState(data, problemId);
  return state !== undefined && isReviewDue(state, now);
}

function isMastered(data: AlgorithmDemoData | null, problemId: string) {
  return getState(data, problemId)?.status === "mastered";
}

function isWeak(data: AlgorithmDemoData | null, problemId: string) {
  const state = getState(data, problemId);
  return state !== undefined && state.attemptCount > 0 && state.mastery < 60;
}

function formatReviewDate(value: string | null | undefined, now: number, timeZone: string) {
  if (!value) return "尚未安排";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "日期待同步";
  if (timestamp <= now) return "已到期";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    timeZone,
  }).format(new Date(timestamp));
}

function getCardStatus(
  data: AlgorithmDemoData | null,
  problemId: string,
  now: number,
) {
  const state = getState(data, problemId);
  if (!state || state.attemptCount === 0) {
    return getTrainingStatusPresentation("unlearned");
  }
  if (isAlgorithmDue(data, problemId, now)) {
    return getTrainingStatusPresentation("due");
  }
  if (state.status === "mastered") {
    return getTrainingStatusPresentation("mastered");
  }
  if (state.mastery < 60) {
    return getTrainingStatusPresentation("weak");
  }
  return getTrainingStatusPresentation("learning");
}

function getInitials(problem: AlgorithmCatalogProblem) {
  return `#${problem.leetcodeId}`;
}

export default function AlgorithmList({
  demoMode,
  initialFilter,
  problems,
  tags,
}: AlgorithmListProps) {
  const [filter, setFilter] = useState<AlgorithmFilter>(initialFilter);
  const [selectedTag, setSelectedTag] = useState("");
  const [demoSnapshot, setDemoSnapshot] = useState<DemoSnapshot | null>(null);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const cloud = useCloudTrainingSnapshot(!demoMode);

  const refreshDemoSnapshot = useCallback(() => {
    if (!demoMode) return;

    const now = new Date();
    const loaded = loadAlgorithmDemoData(getStorage(), now);
    const profile = loadDemoProfile(getStorage(), loaded.planStartDate);
    const ensured = ensureTodayAlgorithmTasks(
      loaded,
      problems.map(toAlgorithmPlannerProblem),
      now,
      {
        newCount: profile.dailyNewAlgorithmCount,
        reviewCount: profile.dailyReviewAlgorithmCount,
        timeZone: profile.timeZone,
      },
    );
    if (ensured.data !== loaded) {
      saveAlgorithmDemoData(getStorage(), ensured.data);
    }
    setDemoSnapshot({
      data: ensured.data,
      tasks: ensured.tasks,
      currentWeek: ensured.currentWeek,
      date: ensured.date,
      now: now.getTime(),
      timeZone: profile.timeZone,
    });
  }, [demoMode, problems]);

  useEffect(() => {
    if (!demoMode) return;

    const initialRefresh = window.setTimeout(refreshDemoSnapshot, 0);
    const onStorageChange = () => refreshDemoSnapshot();
    window.addEventListener("storage", onStorageChange);
    window.addEventListener(ALGORITHM_DEMO_CHANGED_EVENT, onStorageChange);
    window.addEventListener(PROFILE_DEMO_CHANGED_EVENT, onStorageChange);
    window.addEventListener("focus", onStorageChange);
    document.addEventListener("visibilitychange", onStorageChange);
    const timer = window.setInterval(refreshDemoSnapshot, 60_000);

    return () => {
      window.removeEventListener("storage", onStorageChange);
      window.removeEventListener(ALGORITHM_DEMO_CHANGED_EVENT, onStorageChange);
      window.removeEventListener(PROFILE_DEMO_CHANGED_EVENT, onStorageChange);
      window.removeEventListener("focus", onStorageChange);
      document.removeEventListener("visibilitychange", onStorageChange);
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
    };
  }, [demoMode, refreshDemoSnapshot]);

  const cloudSnapshot = useMemo<DemoSnapshot | null>(() => {
    if (!cloud.snapshot) return null;
    const now = new Date();
    const date = getAlgorithmTrainingDateKey(now, cloud.snapshot.profile.timeZone);
    return {
      data: cloud.snapshot.algorithm,
      tasks: cloud.snapshot.algorithm.dailyTasks[date] ?? [],
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
  const importPreview = useMemo(
    () => parseAlgorithmImport(importText, problems),
    [importText, problems],
  );
  const importableProblemIds = useMemo(
    () => importPreview.problemIds.filter((id) => !hasAttempted(data, id)),
    [data, importPreview.problemIds],
  );
  const todayTaskIds = useMemo(
    () => new Set((snapshot?.tasks ?? []).map((task) => task.problemId)),
    [snapshot?.tasks],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<AlgorithmFilter, number> = {
      all: problems.length,
      today: todayTaskIds.size,
      due: 0,
      unlearned: 0,
      mastered: 0,
      weak: 0,
    };

    for (const problem of problems) {
      if (isAlgorithmDue(data, problem.id, now)) counts.due += 1;
      if (!hasAttempted(data, problem.id)) counts.unlearned += 1;
      if (isMastered(data, problem.id)) counts.mastered += 1;
      if (isWeak(data, problem.id)) counts.weak += 1;
    }
    return counts;
  }, [data, now, problems, todayTaskIds]);

  const visibleProblems = useMemo(() => {
    return problems.filter((problem) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "today" && todayTaskIds.has(problem.id)) ||
        (filter === "due" && isAlgorithmDue(data, problem.id, now)) ||
        (filter === "unlearned" && !hasAttempted(data, problem.id)) ||
        (filter === "mastered" && isMastered(data, problem.id)) ||
        (filter === "weak" && isWeak(data, problem.id));
      const matchesTag = selectedTag === "" || problem.tags.includes(selectedTag);
      return matchesFilter && matchesTag;
    });
  }, [data, filter, now, problems, selectedTag, todayTaskIds]);

  const learnedCount = problems.filter((problem) => hasAttempted(data, problem.id)).length;
  const masteredCount = filterCounts.mastered;
  const dueCount = filterCounts.due;
  const todayCompletedCount = snapshot?.tasks.filter(
    (task) => task.status === "completed",
  ).length ?? 0;

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || importableProblemIds.length === 0 || importing) return;
    setImporting(true);
    setImportMessage(null);
    try {
      let importedCount: number;
      let skippedCount: number;
      if (demoMode) {
        const result = importCompletedAlgorithmProblems({
          data,
          importedAt: new Date(),
          problemIds: importableProblemIds,
          userId: ALGORITHM_DEMO_USER_ID,
        });
        if (!saveAlgorithmDemoData(getStorage(), result.data)) {
          throw new Error("浏览器无法保存导入结果。");
        }
        importedCount = result.importedCount;
        skippedCount = importPreview.problemIds.length - importedCount;
        window.dispatchEvent(new Event(ALGORITHM_DEMO_CHANGED_EVENT));
      } else {
        const result = await importCloudAlgorithms(importableProblemIds);
        importedCount = result.importedCount;
        skippedCount = importPreview.problemIds.length - importedCount;
        cloud.setSnapshot(result.snapshot);
      }
      setImportText("");
      setImportMessage({
        kind: "success",
        text: `已导入 ${importedCount} 道题${skippedCount > 0 ? `，跳过 ${skippedCount} 道已有记录` : ""}；3 天后开始复习。`,
      });
    } catch (error) {
      setImportMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "导入失败，请稍后重试。",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                ← Dashboard
              </Link>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-sm font-medium text-muted-foreground">Algorithm</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Hot 100 算法训练
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              用一次短反馈记录真实掌握度，今天练什么由复习日期和薄弱标签决定。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-primary px-3 py-1.5 text-primary-foreground">
              Hot 100 · 快照 2026-09-08
            </span>
            {demoMode ? (
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                浏览器 Demo · 仅此浏览器
              </span>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
                持久数据库
              </span>
            )}
          </div>
        </header>

        {demoMode ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 sm:px-5">
            <p className="font-medium">浏览器演示模式</p>
            <p className="mt-1 text-amber-900/80 dark:text-amber-300/80">
              训练记录保存在浏览器 localStorage，刷新页面不会丢失；当前为第 {snapshot?.currentWeek ?? 1} 周，
              {snapshot ? `今日 ${snapshot.date} 已生成 ${snapshot.tasks.length} 个任务。` : "正在准备今日任务。"}
            </p>
          </section>
        ) : cloud.error ? (
          <section aria-live="assertive" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 sm:px-5">
            {cloud.error}
          </section>
        ) : (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 sm:px-5">
            {snapshot ? `数据库第 ${snapshot.currentWeek} 周 · 今日 ${snapshot.date} 已生成 ${snapshot.tasks.length} 个任务。` : "正在同步训练状态…"}
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="题库总数" value={problems.length} detail="官方 Hot 100" />
          <StatCard label="已开始" value={learnedCount} detail={`${problems.length ? Math.round((learnedCount / problems.length) * 100) : 0}% 已学习`} />
          <StatCard label="已掌握" value={masteredCount} detail="高分且完成间隔复刷" />
          <StatCard label="待复习" value={dueCount} detail={`今日完成 ${todayCompletedCount}/${snapshot?.tasks.length ?? 0}`} />
        </section>

        <details className="rounded-2xl border bg-card shadow-sm">
          <summary className="cursor-pointer px-4 py-4 font-semibold marker:text-muted-foreground sm:px-5">
            导入做过的题
          </summary>
          <form onSubmit={handleImport} className="border-t px-4 py-4 sm:px-5">
            <label htmlFor="algorithm-import" className="text-sm font-medium">
              每行粘贴一道题
            </label>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              支持题号、[题号]题名或 LeetCode 题目链接。导入后不会直接判定为掌握，也不会覆盖现有训练记录。
            </p>
            <textarea
              id="algorithm-import"
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setImportMessage(null);
              }}
              rows={5}
              placeholder={"1\n[49]字母异位词分组\nhttps://leetcode.cn/problems/longest-substring-without-repeating-characters/"}
              className="mt-3 w-full resize-y rounded-xl border bg-background px-3 py-2 font-mono text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                已识别 {importPreview.problemIds.length} 道 · 可导入 {importableProblemIds.length} 道
                {importPreview.unmatchedEntries.length > 0
                  ? ` · ${importPreview.unmatchedEntries.length} 项未匹配`
                  : ""}
              </p>
              <button
                type="submit"
                disabled={!data || importableProblemIds.length === 0 || importing}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? "正在导入…" : `确认导入 ${importableProblemIds.length} 道`}
              </button>
            </div>
            {importMessage ? (
              <p
                aria-live="polite"
                className={`mt-3 text-sm ${importMessage.kind === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}
              >
                {importMessage.text}
              </p>
            ) : null}
          </form>
        </details>

        <section className="scroll-mt-20 rounded-2xl border bg-card p-4 shadow-sm sm:p-5" id="problems">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2" aria-label="训练状态筛选">
              {FILTERS.map((item) => {
                const selected = item.key === filter;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFilter(item.key)}
                    className={`rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                    <span className={`ml-1.5 ${selected ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>
                      {filterCounts[item.key]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="shrink-0 font-medium text-foreground">算法标签</span>
                <select
                  value={selectedTag}
                  onChange={(event) => setSelectedTag(event.target.value)}
                  className="min-w-0 rounded-lg border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
                  aria-label="按算法标签筛选"
                >
                  <option value="">全部标签</option>
                  {tags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-muted-foreground">
                显示 {visibleProblems.length} / {problems.length} 道题
                {selectedTag ? ` · 标签：${selectedTag}` : ""}
              </p>
            </div>
          </div>
        </section>

        {visibleProblems.length === 0 ? (
          <section className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
            <p className="text-base font-semibold">这个筛选下还没有题目</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {filter === "today"
                ? "今天的任务已经完成，或者计划还没有生成任务。"
                : "换一个筛选条件，继续浏览 Hot 100。"}
            </p>
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setSelectedTag("");
              }}
              className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              查看全部题目
            </button>
          </section>
        ) : (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Hot 100 题目列表">
            {visibleProblems.map((problem) => (
              <AlgorithmCard
                key={problem.id}
                problem={problem}
                data={data}
                isToday={todayTaskIds.has(problem.id)}
                now={now}
                timeZone={snapshot?.timeZone ?? "Asia/Shanghai"}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4 shadow-sm sm:px-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function AlgorithmCard({
  data,
  isToday,
  now,
  problem,
  timeZone,
}: {
  data: AlgorithmDemoData | null;
  isToday: boolean;
  now: number;
  problem: AlgorithmCatalogProblem;
  timeZone: string;
}) {
  const state = getState(data, problem.id);
  const status = getCardStatus(data, problem.id, now);
  const mastery = state?.mastery;
  const progressWidth = Math.max(0, Math.min(100, mastery ?? 0));

  return (
    <Link
      href={`/algorithm/${problem.id}`}
      className="group flex min-h-56 flex-col rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-ring hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-sm font-semibold text-muted-foreground">
            {getInitials(problem)}
          </span>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${DIFFICULTY_STYLES[problem.difficulty]}`}>
            {DIFFICULTY_LABELS[problem.difficulty]}
          </span>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>

      <h2 className="mt-4 line-clamp-2 text-base font-semibold leading-6 group-hover:text-foreground/70">
        {problem.title}
      </h2>
      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{problem.titleEn}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {problem.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            {tag}
          </span>
        ))}
        {problem.tags.length > 3 ? (
          <span className="rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground/70">
            +{problem.tags.length - 3}
          </span>
        ) : null}
      </div>

      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">掌握度</span>
          <span className="font-semibold">{mastery === undefined ? "—" : `${Math.round(mastery)}%`}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className={`h-full rounded-full transition-all ${status.label === "已掌握" ? "bg-emerald-500" : status.label === "薄弱" ? "bg-rose-500" : status.label === "待复习" ? "bg-amber-500" : "bg-muted-foreground"}`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>训练 {state?.attemptCount ?? 0} 次</span>
          <span>
            {isToday ? "今日任务" : `下次复习：${formatReviewDate(state?.nextReviewAt, now, timeZone)}`}
          </span>
        </div>
      </div>
    </Link>
  );
}
