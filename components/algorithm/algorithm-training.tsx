"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  ALGORITHM_DEMO_CHANGED_EVENT,
  ALGORITHM_DEMO_TIME_ZONE,
  attachDemoAlgorithmAnalysis,
  cancelDemoAlgorithmAttempt,
  completeDemoAlgorithmAttempt,
  ensureTodayAlgorithmTasks,
  loadAlgorithmDemoData,
  saveAlgorithmDemoData,
  startDemoAlgorithmAttempt,
  type AlgorithmDemoData,
} from "@/lib/algorithm/demo-store";
import {
  loadDemoProfile,
  PROFILE_DEMO_CHANGED_EVENT,
} from "@/lib/profile/demo-store";
import type {
  AlgorithmStatePayload,
  CompleteAlgorithmAttemptResult,
} from "@/lib/algorithm/attempts";
import type { AlgorithmPlannerProblem } from "@/lib/planner/algorithm";
import type {
  AlgorithmIndependence,
  AlgorithmMistakeTag,
  AlgorithmResult,
} from "@/lib/mastery/algorithm";
import type { AlgorithmCatalogProblem } from "@/lib/algorithm/catalog";
import {
  parseAlgorithmCodeAnalysis,
  type AlgorithmCodeAnalysis,
} from "@/lib/ai/code-analysis";
import {
  cancelCloudAttempt,
  completeCloudAttempt,
  saveCloudAlgorithmAnalysis,
  startCloudAttempt,
} from "@/lib/supabase/training-client";
import type { CloudTrainingSnapshot } from "@/lib/supabase/training";
import { useCloudTrainingSnapshot } from "@/lib/supabase/use-cloud-training";

type TrainingMode = "idle" | "timing" | "feedback" | "complete";

const resultOptions: readonly {
  value: AlgorithmResult;
  label: string;
  description: string;
}[] = [
  {
    value: "first_ac",
    label: "一次 AC",
    description: "独立完成并通过",
  },
  {
    value: "wa_then_ac",
    label: "先错后 AC",
    description: "经历错误后通过",
  },
  {
    value: "failed",
    label: "未通过",
    description: "没有完成或仍未通过",
  },
];

const independenceOptions: readonly {
  value: AlgorithmIndependence;
  label: string;
}[] = [
  { value: "independent", label: "完全独立" },
  { value: "small_hint", label: "看了小提示" },
  { value: "solution_hint", label: "看过思路" },
  { value: "full_solution", label: "看完整题解" },
];

const mistakeTagOptions: readonly {
  value: AlgorithmMistakeTag;
  label: string;
}[] = [
  { value: "no_idea", label: "没有思路" },
  { value: "wrong_idea", label: "思路错误" },
  { value: "boundary", label: "边界条件" },
  { value: "pointer", label: "指针处理" },
  { value: "state", label: "状态转移" },
  { value: "java_syntax", label: "Java 语法" },
  { value: "java_api", label: "Java API" },
  { value: "data_structure", label: "数据结构" },
  { value: "complexity", label: "复杂度判断" },
  { value: "careless", label: "粗心失误" },
];

const solutionTypeLabels: Record<AlgorithmCodeAnalysis["solutionType"], string> = {
  brute_force: "暴力枚举",
  hashing: "哈希",
  two_pointers: "双指针",
  sliding_window: "滑动窗口",
  binary_search: "二分查找",
  dynamic_programming: "动态规划",
  graph_tree: "图 / 树",
  other: "其他",
};

const CODE_DRAFT_PREFIX = "offerpilot:algorithm-code-draft:";

function codeDraftKey(attemptId: string) {
  return `${CODE_DRAFT_PREFIX}${attemptId}`;
}

function clearCodeDraft(attemptId: string) {
  try {
    window.localStorage.removeItem(codeDraftKey(attemptId));
  } catch {
    // The completed attempt is already durable; stale local drafts are harmless.
  }
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDate(value: string | null, timeZone: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "保存失败，请稍后再试。";
}

function trainingStateLabel(state: AlgorithmStatePayload | null) {
  if (!state) return "未学习";
  if (state.status === "mastered") return "已掌握";
  if (state.status === "due") return "待复习";
  if (state.mastery >= 85) return "待间隔复刷";
  if (state.mastery < 60) return "薄弱";
  return "训练中";
}

function masteryColor(mastery: number) {
  if (mastery >= 85) return "text-emerald-700 dark:text-emerald-400";
  if (mastery >= 60) return "text-amber-700 dark:text-amber-400";
  if (mastery > 0) return "text-orange-700 dark:text-orange-400";
  return "text-muted-foreground";
}

export function AlgorithmTraining({
  demoMode,
  plannerProblems,
  problem,
}: {
  demoMode: boolean;
  plannerProblems: readonly AlgorithmPlannerProblem[];
  problem: AlgorithmCatalogProblem;
}) {
  const [data, setData] = useState<AlgorithmDemoData | null>(null);
  const [timeZone, setTimeZone] = useState<string>(ALGORITHM_DEMO_TIME_ZONE);
  const [mode, setMode] = useState<TrainingMode>("idle");
  const [clock, setClock] = useState(() => Date.now());
  const [feedbackEndedAt, setFeedbackEndedAt] = useState<number | null>(null);
  const [completion, setCompletion] =
    useState<CompleteAlgorithmAttemptResult | null>(null);
  const [result, setResult] = useState<AlgorithmResult>("first_ac");
  const [independence, setIndependence] =
    useState<AlgorithmIndependence>("independent");
  const [waCount, setWaCount] = useState("0");
  const [mistakeTags, setMistakeTags] = useState<AlgorithmMistakeTag[]>([]);
  const [code, setCode] = useState("");
  const [aiStatus, setAiStatus] = useState<"idle" | "loading">("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const applyCloudSnapshot = useCallback((snapshot: CloudTrainingSnapshot) => {
    setData(snapshot.algorithm);
    setTimeZone(snapshot.profile.timeZone);
    setMode((current) =>
      current === "feedback" || current === "complete"
        ? current
        : snapshot.algorithm.activeAttempts[problem.id]
          ? "timing"
          : "idle",
    );
  }, [problem.id]);
  const cloud = useCloudTrainingSnapshot(!demoMode, applyCloudSnapshot);

  const activeAttempt = data?.activeAttempts[problem.id] ?? null;
  const currentState = data?.states[problem.id] ?? null;
  const elapsedSeconds = activeAttempt
    ? Math.max(0, Math.floor((clock - new Date(activeAttempt.startedAt).getTime()) / 1000))
    : 0;
  const feedbackDuration = activeAttempt
    ? Math.max(
        0,
        Math.floor(
          ((feedbackEndedAt ?? clock) - new Date(activeAttempt.startedAt).getTime()) / 1000,
        ),
      )
    : 0;

  const currentTask = useMemo(
    () =>
      data
        ? Object.values(data.dailyTasks)
            .flat()
            .find((task) => task.problemId === problem.id && task.date === Object.keys(data.dailyTasks).sort().at(-1))
        : undefined,
    [data, problem.id],
  );

  useEffect(() => {
    if (!demoMode) return;

    try {
      const loaded = loadAlgorithmDemoData(window.localStorage);
      const profile = loadDemoProfile(window.localStorage, loaded.planStartDate);
      const ensured = ensureTodayAlgorithmTasks(
        loaded,
        plannerProblems,
        new Date(),
        {
          newCount: profile.dailyNewAlgorithmCount,
          reviewCount: profile.dailyReviewAlgorithmCount,
          timeZone: profile.timeZone,
        },
      );
      if (ensured.data !== loaded && !saveAlgorithmDemoData(window.localStorage, ensured.data)) {
        window.setTimeout(
          () => setError("无法保存本地训练数据，请检查浏览器存储空间。"),
          0,
        );
      }
      setData(ensured.data);
      setTimeZone(profile.timeZone);
      setMode(ensured.data.activeAttempts[problem.id] ? "timing" : "idle");
    } catch (loadError) {
      window.setTimeout(() => setError(errorMessage(loadError)), 0);
    }
  }, [demoMode, plannerProblems, problem.id]);

  useEffect(() => {
    if (!demoMode) return;

    const refresh = () => {
      try {
        const loaded = loadAlgorithmDemoData(window.localStorage);
        const profile = loadDemoProfile(window.localStorage, loaded.planStartDate);
        const ensured = ensureTodayAlgorithmTasks(
          loaded,
          plannerProblems,
          new Date(),
          {
            newCount: profile.dailyNewAlgorithmCount,
            reviewCount: profile.dailyReviewAlgorithmCount,
            timeZone: profile.timeZone,
          },
        );
        if (ensured.data !== loaded) saveAlgorithmDemoData(window.localStorage, ensured.data);
        setData(ensured.data);
        setTimeZone(profile.timeZone);
        setMode((current) => ensured.data.activeAttempts[problem.id]
          ? "timing"
          : current === "timing" ? "idle" : current);
      } catch (loadError) {
        setError(errorMessage(loadError));
      }
    };

    window.addEventListener("storage", refresh);
    window.addEventListener(ALGORITHM_DEMO_CHANGED_EVENT, refresh);
    window.addEventListener(PROFILE_DEMO_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(ALGORITHM_DEMO_CHANGED_EVENT, refresh);
      window.removeEventListener(PROFILE_DEMO_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [demoMode, plannerProblems, problem.id]);

  useEffect(() => {
    if (mode !== "timing" || !activeAttempt) return;

    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeAttempt, mode]);

  useEffect(() => {
    if (!activeAttempt) return;

    let timer: number | undefined;
    try {
      const draft = window.localStorage.getItem(codeDraftKey(activeAttempt.id));
      if (draft !== null) {
        timer = window.setTimeout(() => setCode((current) => current || draft), 0);
      }
    } catch {
      timer = window.setTimeout(
        () => setError("无法读取代码草稿；本次页面内输入仍可正常提交。"),
        0,
      );
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [activeAttempt]);

  function persist(nextData: AlgorithmDemoData) {
    if (!saveAlgorithmDemoData(window.localStorage, nextData)) {
      setError("无法保存本地训练数据，请检查浏览器存储空间。");
      return false;
    }

    setData(nextData);
    window.dispatchEvent(new Event(ALGORITHM_DEMO_CHANGED_EVENT));
    return true;
  }

  async function handleStart() {
    if (!data || saving) return;

    setError(null);
    setSaving(true);
    try {
      if (!demoMode) {
        const started = await startCloudAttempt(problem.id);
        cloud.setSnapshot(started.snapshot);
        setMode("timing");
        setClock(Date.now());
        return;
      }
      const started = startDemoAlgorithmAttempt({
        data,
        problemId: problem.id,
        startedAt: new Date(),
        timeZone,
      });
      if (persist(started.data)) {
        setMode("timing");
        setClock(Date.now());
      }
    } catch (startError) {
      setError(errorMessage(startError));
    } finally {
      setSaving(false);
    }
  }

  function handleFinish() {
    if (!activeAttempt) return;

    setError(null);
    setFeedbackEndedAt(Date.now());
    setMode("feedback");
  }

  async function handleCancel() {
    if (!data || !activeAttempt || saving) return;
    if (!window.confirm("取消本次训练？本次计时和未提交代码将被清除，历史成绩与 Mastery 不受影响。")) {
      return;
    }

    setError(null);
    setSaving(true);
    try {
      if (!demoMode) {
        const canceled = await cancelCloudAttempt({
          attemptId: activeAttempt.id,
          problemId: problem.id,
        });
        cloud.setSnapshot(canceled.snapshot);
      } else {
        const canceled = cancelDemoAlgorithmAttempt({
          data,
          attemptId: activeAttempt.id,
          problemId: problem.id,
        });
        if (!persist(canceled.data)) return;
      }
      clearCodeDraft(activeAttempt.id);
      setCode("");
      setFeedbackEndedAt(null);
      setMode("idle");
    } catch (cancelError) {
      setError(errorMessage(cancelError));
    } finally {
      setSaving(false);
    }
  }

  function toggleMistakeTag(tag: AlgorithmMistakeTag) {
    setMistakeTags((current) =>
      current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag],
    );
  }

  async function handleAiAnalysis() {
    const completed = completion;
    const savedCode = completed?.attempt.code?.trim();
    if (!completed || !savedCode || !data || aiStatus === "loading") return;

    setAiError(null);
    setAiStatus("loading");
    try {
      const response = await fetch("/api/ai/analyze-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.id, code: savedCode }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "AI 分析失败，请稍后重试。";
        throw new Error(message);
      }
      const value = payload && typeof payload === "object" && "analysis" in payload
        ? payload.analysis
        : null;
      const analysis = parseAlgorithmCodeAnalysis(value);
      if (!demoMode) {
        const saved = await saveCloudAlgorithmAnalysis({
          attemptId: completed.attempt.id,
          problemId: problem.id,
          aiAnalysis: analysis,
        });
        cloud.setSnapshot(saved.snapshot);
        setCompletion((current) => current?.attempt.id === saved.attempt.id
          ? { ...current, attempt: saved.attempt }
          : current);
        return;
      }

      const saved = attachDemoAlgorithmAnalysis({
        data,
        attemptId: completed.attempt.id,
        problemId: problem.id,
        aiAnalysis: analysis,
      });
      if (!persist(saved.data)) {
        throw new Error("AI 复盘已生成，但未能保存，请重试。");
      }
      setCompletion((current) => current?.attempt.id === saved.attempt.id
        ? { ...current, attempt: saved.attempt }
        : current);
    } catch (analysisError) {
      setAiError(errorMessage(analysisError));
    } finally {
      setAiStatus("idle");
    }
  }

  async function handleSubmitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !activeAttempt || saving) return;

    const parsedWaCount = Number(waCount);
    if (!Number.isSafeInteger(parsedWaCount) || parsedWaCount < 0 || parsedWaCount > 3) {
      setError("WA 次数必须是 0、1、2 或 3+。");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      if (!demoMode) {
        const completed = await completeCloudAttempt({
          attemptId: activeAttempt.id,
          problemId: problem.id,
          finishedAt: new Date(feedbackEndedAt ?? Date.now()).toISOString(),
          result,
          independence,
          waCount: parsedWaCount,
          mistakeTags,
          code: code.trim() ? code : null,
          aiAnalysis: null,
        });
        cloud.setSnapshot(completed.snapshot);
        setCompletion(completed.completion);
        setMode("complete");
        setFeedbackEndedAt(null);
        clearCodeDraft(activeAttempt.id);
        return;
      }
      const completed = completeDemoAlgorithmAttempt({
        data,
        problemId: problem.id,
        difficulty: problem.difficulty,
        finishedAt: new Date(feedbackEndedAt ?? Date.now()),
        result,
        independence,
        waCount: parsedWaCount,
        mistakeTags,
        code: code.trim() ? code : null,
        aiAnalysis: null,
        timeZone,
      });
      if (persist(completed.data)) {
        setCompletion(completed);
        setMode("complete");
        setFeedbackEndedAt(null);
        clearCodeDraft(activeAttempt.id);
      }
    } catch (completionError) {
      setError(errorMessage(completionError));
    } finally {
      setSaving(false);
    }
  }

  function handleTrainAgain() {
    setCompletion(null);
    setResult("first_ac");
    setIndependence("independent");
    setWaCount("0");
    setMistakeTags([]);
    setCode("");
    setAiStatus("idle");
    setAiError(null);
    setError(null);
    setMode("idle");
  }

  const mastery = currentState?.mastery ?? 0;
  const pageStatus = data === null
      ? "正在加载本地数据"
      : mode === "timing"
        ? "计时中"
        : mode === "feedback"
          ? "填写反馈"
          : mode === "complete"
            ? "本次已完成"
            : "准备开始";
  const codeEditor = activeAttempt ? (
    <label className="grid gap-2 text-sm font-medium" htmlFor="java-code">
      Java 代码（可选）
      <textarea
        autoCapitalize="off"
        autoCorrect="off"
        className="min-h-72 resize-y rounded-lg border bg-background px-4 py-3 font-mono text-sm font-normal leading-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        id="java-code"
        maxLength={20_000}
        onChange={(event) => {
          const nextCode = event.target.value;
          setCode(nextCode);
          setAiError(null);
          try {
            window.localStorage.setItem(
              codeDraftKey(activeAttempt.id),
              nextCode,
            );
          } catch {
            setError("代码已保留在当前页面，但无法自动保存草稿。");
          }
        }}
        placeholder="在这里编写或粘贴 Java 解题代码…"
        spellCheck={false}
        value={code}
      />
      <span className="text-xs font-normal text-muted-foreground">
        草稿自动保存在当前浏览器；结束训练后会原样带入反馈。
      </span>
    </label>
  ) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div>
          <Link
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            href="/algorithm"
          >
            ← 返回 Hot 100
          </Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Algorithm training
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${demoMode ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200" : "bg-muted text-muted-foreground"}`}
        >
          {demoMode ? "浏览器演示模式" : "持久数据库"}
        </span>
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border px-2.5 py-1">Hot 100 · #{problem.leetcodeId}</span>
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                problem.difficulty === "easy"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : problem.difficulty === "medium"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
              }`}
            >
              {problem.difficulty === "easy" ? "简单" : problem.difficulty === "medium" ? "中等" : "困难"}
            </span>
            {problem.tags.slice(0, 4).map((tag) => (
              <span className="rounded-full bg-muted px-2.5 py-1" key={tag}>
                {tag}
              </span>
            ))}
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            {problem.title}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">{problem.titleEn}</p>

          <div className="mt-7 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">当前刷次</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentTask?.status === "completed"
                    ? "今日任务已完成，可以继续巩固。"
                    : "先在 LeetCode 完成题目，再回来记录一次真实反馈。"}
                </p>
              </div>
              <span
                aria-live="polite"
                className={`rounded-full border px-3 py-1 text-xs font-medium ${mode === "timing" ? "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300" : "text-muted-foreground"}`}
              >
                {pageStatus}
              </span>
            </div>

            {mode === "timing" && activeAttempt ? (
              <div className="mt-8 space-y-5">
                <div className="rounded-xl bg-primary px-5 py-6 text-primary-foreground sm:flex sm:items-center sm:justify-between sm:gap-6">
                  <div>
                    <p className="text-sm text-primary-foreground/70">本次已用时</p>
                    <p aria-live="polite" className="mt-1 font-mono text-4xl font-semibold tabular-nums">
                      {formatDuration(elapsedSeconds)}
                    </p>
                    <p className="mt-2 text-xs text-primary-foreground/70">
                      开始于 {formatDate(activeAttempt.startedAt, timeZone)} · 刷新页面会继续计时
                    </p>
                  </div>
                  <div className="mt-5 flex w-full flex-col-reverse gap-2 sm:mt-0 sm:w-auto sm:flex-row">
                    <Button
                      className="text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
                      disabled={saving}
                      onClick={handleCancel}
                      type="button"
                      variant="ghost"
                    >
                      {saving ? "取消中…" : "取消训练"}
                    </Button>
                    <Button disabled={saving} onClick={handleFinish} type="button" variant="secondary">
                      结束训练，填写反馈
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4 sm:p-5">
                  {codeEditor}
                </div>
              </div>
            ) : mode === "feedback" && activeAttempt ? (
              <form className="mt-7 space-y-6" onSubmit={handleSubmitFeedback}>
                <div className="rounded-xl border bg-muted/40 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">本次用时</span>
                    <span className="font-mono font-semibold tabular-nums">{formatDuration(feedbackDuration)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">反馈大约 10 秒完成，提交后会立即更新 mastery 和下次复习时间。</p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium" htmlFor="result">
                    结果
                    <select className="h-10 rounded-lg border bg-background px-3 font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50" id="result" onChange={(event) => setResult(event.target.value as AlgorithmResult)} value={result}>
                      {resultOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} · {option.description}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium" htmlFor="independence">
                    独立性
                    <select className="h-10 rounded-lg border bg-background px-3 font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50" id="independence" onChange={(event) => setIndependence(event.target.value as AlgorithmIndependence)} value={independence}>
                      {independenceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid max-w-xs gap-2 text-sm font-medium" htmlFor="wa-count">
                  WA 次数（3 表示 3+）
                  <select className="h-10 rounded-lg border bg-background px-3 font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50" id="wa-count" onChange={(event) => setWaCount(event.target.value)} value={waCount}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3+</option>
                  </select>
                </label>

                <fieldset>
                  <legend className="text-sm font-medium">错误标签（可选）</legend>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {mistakeTagOptions.map((option) => (
                      <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors has-checked:border-primary has-checked:bg-muted" key={option.value}>
                        <input checked={mistakeTags.includes(option.value)} className="size-4 accent-primary" onChange={() => toggleMistakeTag(option.value)} type="checkbox" />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {codeEditor}

                <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">先按确定性规则保存分数、mastery 和复习间隔；AI 复盘不会阻塞保存。</p>
                  <Button disabled={saving} type="submit">{saving ? "保存中…" : "保存本次反馈"}</Button>
                </div>
              </form>
            ) : mode === "complete" && completion ? (
              <div aria-live="polite" className="mt-7 space-y-5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">本次训练已保存</p>
                  <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-300/80">分数和复习计划已经写入{demoMode ? "浏览器 Demo" : "数据库"}，下一次到期会重新进入任务。</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="本次分数" value={`${completion.attempt.attemptScore ?? 0}`} />
                  <Metric label="Mastery" value={`${completion.state.mastery}`} />
                  <Metric label="下次复习" value={formatDate(completion.state.nextReviewAt, timeZone)} />
                </div>
                {completion.attempt.code ? (
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">AI 代码复盘（可选）</p>
                        <p className="mt-1 text-xs text-muted-foreground">训练已保存。AI 仅分析本次代码并记录复盘，不会修改 mastery。</p>
                      </div>
                      <Button disabled={aiStatus === "loading"} onClick={handleAiAnalysis} type="button" variant="outline">
                        {aiStatus === "loading"
                          ? "分析并保存中…"
                          : completion.attempt.aiAnalysis
                            ? "重新分析"
                            : "AI 分析代码"}
                      </Button>
                    </div>
                    {aiError ? <p aria-live="assertive" className="mt-3 text-sm text-destructive">{aiError}</p> : null}
                    {completion.attempt.aiAnalysis ? <AnalysisPanel analysis={completion.attempt.aiAnalysis} /> : null}
                  </div>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button onClick={handleTrainAgain} type="button">再刷一次</Button>
                  <Link className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href="/algorithm">
                    返回题目列表
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">准备好后开始记录计时。</p>
                  <p className="mt-1 text-xs text-muted-foreground">计时只用于本次反馈，不会限制你在 LeetCode 上的思考时间。</p>
                </div>
                <Button className="w-full sm:w-auto" disabled={!data || saving} onClick={handleStart} type="button">{saving ? "开始中…" : "开始训练"}</Button>
              </div>
            )}

            {error ?? cloud.error ? (
              <p aria-live="assertive" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error ?? cloud.error}
              </p>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">掌握度</p>
                <p className={`mt-2 text-4xl font-semibold tracking-tight ${masteryColor(mastery)}`}>{mastery}<span className="ml-1 text-base font-normal text-muted-foreground">/ 100</span></p>
              </div>
              <span className={`rounded-full bg-muted px-2.5 py-1 text-xs font-medium ${masteryColor(mastery)}`}>{trainingStateLabel(currentState)}</span>
            </div>
            <div aria-hidden="true" className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${mastery}%` }} />
            </div>
            <dl className="mt-5 grid gap-3 border-t pt-4 text-sm">
              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">累计刷题</dt><dd className="font-medium">{currentState?.attemptCount ?? 0} 次</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">当前状态</dt><dd className="font-medium">{trainingStateLabel(currentState)}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">下次复习</dt><dd className="text-right font-medium">{formatDate(currentState?.nextReviewAt ?? null, timeZone)}</dd></div>
            </dl>
          </div>

          <div className="rounded-2xl border bg-muted/40 p-5 text-sm">
            <p className="font-semibold">训练提示</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>先独立思考，再打开题解。</li>
              <li>记录真实结果，mastery 才有意义。</li>
              <li>Java 代码可选；AI 分析只做复盘，不参与 mastery。</li>
            </ul>
            <a className="mt-5 inline-flex text-sm font-medium underline-offset-4 hover:underline" href={problem.url} rel="noreferrer" target="_blank">
              在 LeetCode 新页打开 ↗
            </a>
          </div>
        </aside>
      </section>
    </main>
  );
}

function AnalysisPanel({ analysis }: { analysis: AlgorithmCodeAnalysis }) {
  return (
    <div className="mt-4 space-y-4 border-t pt-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="解法类型" value={solutionTypeLabels[analysis.solutionType]} />
        <Metric label="时间复杂度" value={analysis.complexity.time} />
        <Metric label="空间复杂度" value={analysis.complexity.space} />
      </div>
      <div>
        <p className="font-medium">思路小结</p>
        <p className="mt-1 text-muted-foreground">{analysis.summary}</p>
      </div>
      <AnalysisList items={analysis.goodPoints} title="做得好的地方" />
      <AnalysisList items={analysis.mistakes} title="需要留意" />
      <AnalysisList items={analysis.minimalChanges} title="最小修改建议" />
      {analysis.javaBasics?.length ? (
        <section>
          <p className="font-medium">本题 Java 基础语法</p>
          <p className="mt-1 text-xs text-muted-foreground">只整理这次代码实际涉及的方法，方便针对性复习。</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {analysis.javaBasics.map((item) => (
              <article className="rounded-xl border bg-muted/30 p-4" key={`${item.name}-${item.syntax}`}>
                <code className="font-semibold text-foreground">{item.name}</code>
                <p className="mt-2 text-muted-foreground">{item.purpose}</p>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 text-xs"><code>{item.syntax}</code></pre>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-xs"><code>{item.example}</code></pre>
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">易错点：{item.pitfall}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AnalysisList({ items, title }: { items: readonly string[]; title: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}
