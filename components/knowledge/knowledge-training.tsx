"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { RecallResult } from "@/components/knowledge/recall-result";
import { RecallHistoryPanel } from "@/components/knowledge/recall-history-panel";
import { RecallScoreComparison } from "@/components/knowledge/recall-score-comparison";
import { VoiceAnswerButton } from "@/components/knowledge/voice-answer-button";
import {
  parseKnowledgeRecallAnalysis,
  type KnowledgeRecallAnalysis,
} from "@/lib/ai/knowledge-recall-analysis";
import {
  ALGORITHM_DEMO_TIME_ZONE,
  getAlgorithmTrainingDateKey,
  getTrainingDayStart,
} from "@/lib/algorithm/demo-store";
import type {
  KnowledgeAttemptPayload,
  KnowledgeStatePayload,
} from "@/lib/knowledge/attempts";
import type {
  KnowledgeKeywordAliases,
  KnowledgePointWeights,
} from "@/lib/knowledge/match";
import {
  ensureTodayKnowledgeTasks,
  KNOWLEDGE_DEMO_CHANGED_EVENT,
  learnDemoKnowledgeQuestion,
  loadKnowledgeDemoData,
  recallDemoKnowledgeQuestion,
  saveKnowledgeDemoData,
  type KnowledgeDemoData,
} from "@/lib/knowledge/demo-store";
import { getKnowledgeRecallHistory } from "@/lib/knowledge/recall-history";
import type { KnowledgeSelfRating } from "@/lib/mastery/knowledge";
import type { KnowledgePlannerQuestion } from "@/lib/planner/knowledge";
import {
  nextTrainingTaskLabel,
  selectNextTrainingTask,
} from "@/lib/progress/next-task";
import {
  loadDemoProfile,
  PROFILE_DEMO_CHANGED_EVENT,
} from "@/lib/profile/demo-store";
import { isPlanPaused, type PlanPausePeriod } from "@/lib/profile/pause";
import { getTrainingStatusPresentation } from "@/lib/ui/training-status";
import {
  recordCloudKnowledge,
} from "@/lib/supabase/training-client";
import type { CloudTrainingSnapshot } from "@/lib/supabase/training";
import { useCloudTrainingSnapshot } from "@/lib/supabase/use-cloud-training";

export type KnowledgeTrainingQuestion = {
  id: string;
  category: string;
  topic: string;
  question: string;
  questionType: "main" | "follow_up";
  importance: number;
  shortAnswer: string;
  interviewAnswer: string;
  fullAnswer: string;
  keyPoints: readonly string[];
  keywordAliases: KnowledgeKeywordAliases;
  keyPointWeights: KnowledgePointWeights;
  sourceBook: string;
  sourceSection: string;
};

type Submission = {
  attempt: KnowledgeAttemptPayload;
  state: KnowledgeStatePayload;
  attemptScore?: number;
};

const ratings: readonly {
  value: KnowledgeSelfRating;
  label: string;
  mastery: number;
}[] = [
  { value: 1, label: "完全不懂", mastery: 15 },
  { value: 2, label: "有点理解", mastery: 30 },
  { value: 3, label: "基本理解", mastery: 45 },
  { value: 4, label: "很熟悉", mastery: 55 },
];

function formatDate(value: string | null | undefined, timeZone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function statusPresentation(state: KnowledgeStatePayload | null, now: number) {
  if (!state) return getTrainingStatusPresentation("unlearned");
  if (new Date(state.nextReviewAt).getTime() <= now) return getTrainingStatusPresentation("due");
  if (state.status === "mastered") return getTrainingStatusPresentation("mastered");
  if (state.mastery < 60) return getTrainingStatusPresentation("weak");
  return getTrainingStatusPresentation("learning");
}

export function KnowledgeTraining({
  demoMode,
  followUps,
  plannerQuestions,
  question,
}: {
  demoMode: boolean;
  followUps: readonly { id: string; question: string }[];
  plannerQuestions: readonly KnowledgePlannerQuestion[];
  question: KnowledgeTrainingQuestion;
}) {
  const [data, setData] = useState<KnowledgeDemoData | null>(null);
  const [timeZone, setTimeZone] = useState<string>(ALGORITHM_DEMO_TIME_ZONE);
  const [pausePeriods, setPausePeriods] = useState<PlanPausePeriod[]>([]);
  const [clock, setClock] = useState(() => Date.now());
  const [answer, setAnswer] = useState("");
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<KnowledgeRecallAnalysis | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading">("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const pendingAttemptId = useRef<string | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const applyCloudSnapshot = useCallback((snapshot: CloudTrainingSnapshot) => {
    setData(snapshot.knowledge);
    setTimeZone(snapshot.profile.timeZone);
    setPausePeriods(snapshot.profile.pausePeriods ?? []);
  }, []);
  const cloud = useCloudTrainingSnapshot(!demoMode, applyCloudSnapshot);
  const state = data?.states[question.id] ?? null;

  useEffect(() => {
    if (!demoMode) return;
    const load = () => {
      try {
        const loaded = loadKnowledgeDemoData(window.localStorage);
        const profile = loadDemoProfile(window.localStorage, loaded.planStartDate);
        const ensured = ensureTodayKnowledgeTasks(loaded, plannerQuestions, new Date(), {
          newCount: profile.dailyNewKnowledgeCount,
          reviewCount: profile.dailyReviewKnowledgeCount,
          timeZone: profile.timeZone,
          pausePeriods: profile.pausePeriods ?? [],
        });
        if (ensured.data !== loaded) saveKnowledgeDemoData(window.localStorage, ensured.data);
        setData(ensured.data);
        setTimeZone(profile.timeZone);
        setPausePeriods(profile.pausePeriods ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "读取本地训练数据失败。");
      }
    };
    const initialLoad = window.setTimeout(load, 0);
    window.addEventListener("storage", load);
    window.addEventListener(KNOWLEDGE_DEMO_CHANGED_EVENT, load);
    window.addEventListener(PROFILE_DEMO_CHANGED_EVENT, load);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    const timer = window.setInterval(load, 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      window.removeEventListener("storage", load);
      window.removeEventListener(KNOWLEDGE_DEMO_CHANGED_EVENT, load);
      window.removeEventListener(PROFILE_DEMO_CHANGED_EVENT, load);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [demoMode, plannerQuestions]);

  function persist(nextData: KnowledgeDemoData) {
    if (!saveKnowledgeDemoData(window.localStorage, nextData)) {
      setError("无法保存本地训练数据，请检查浏览器存储空间。");
      return false;
    }
    setData(nextData);
    window.dispatchEvent(new Event(KNOWLEDGE_DEMO_CHANGED_EVENT));
    return true;
  }

  async function submitLearn(selfRating: KnowledgeSelfRating) {
    if (!data || saving) return;
    setError(null);
    setSaving(true);
    try {
      if (!demoMode) {
        const attemptId = pendingAttemptId.current ?? crypto.randomUUID();
        pendingAttemptId.current = attemptId;
        const result = await recordCloudKnowledge({
          attemptId,
          mode: "learn",
          questionId: question.id,
          attemptedAt: new Date().toISOString(),
          selfRating,
        });
        cloud.applyMutation(result.mutation);
        setSubmission(result.mutation.result);
        pendingAttemptId.current = null;
        return;
      }
      const result = learnDemoKnowledgeQuestion({
        data,
        questionId: question.id,
        selfRating,
        timeZone,
      });
      if (persist(result.data)) {
        setSubmission(result);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存学习结果失败。");
    } finally {
      setSaving(false);
    }
  }

  async function submitRecall(answerText: string) {
    if (!data || saving) return;
    setError(null);
    setAiAnalysis(null);
    setAiError(null);
    setSaving(true);
    try {
      // AI 主导计分：先取语义复核再落库。复核失败不阻塞提交，本次按确定性覆盖率计分。
      let recallAiAnalysis: KnowledgeRecallAnalysis | null = null;
      if (answerText.trim()) {
        const { analysis, error: analysisError } = await requestAiAnalysis(answerText);
        recallAiAnalysis = analysis;
        if (analysisError) {
          setAiError(`AI 语义复核不可用，本次已按确定性覆盖率计分：${analysisError}`);
        }
      }
      setAiAnalysis(recallAiAnalysis);

      if (!demoMode) {
        const attemptId = pendingAttemptId.current ?? crypto.randomUUID();
        pendingAttemptId.current = attemptId;
        const result = await recordCloudKnowledge({
          attemptId,
          mode: "recall",
          questionId: question.id,
          attemptedAt: new Date().toISOString(),
          answerText,
          aiAnalysis: recallAiAnalysis,
        });
        cloud.applyMutation(result.mutation);
        setSubmission(result.mutation.result);
        setAnswer("");
        pendingAttemptId.current = null;
        return;
      }
      const result = recallDemoKnowledgeQuestion({
        data,
        questionId: question.id,
        answerText,
        keyPoints: question.keyPoints,
        keywordAliases: question.keywordAliases,
        keyPointWeights: question.keyPointWeights,
        aiAnalysis: recallAiAnalysis,
        timeZone,
      });
      if (persist(result.data)) {
        setSubmission(result);
        setAnswer("");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存回忆结果失败。");
    } finally {
      setSaving(false);
    }
  }

  function handleRecall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitRecall(answer.trim());
  }

  /**
   * 取 AI 语义复核。提交时同步调用，失败不抛出：调用方按确定性分回退。
   */
  async function requestAiAnalysis(answerText: string): Promise<{ analysis: KnowledgeRecallAnalysis | null; error: string | null }> {
    try {
      const response = await fetch("/api/ai/analyze-recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answerText }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "AI 复核失败，请稍后重试。";
        return { analysis: null, error: message };
      }
      const value = payload && typeof payload === "object" && "analysis" in payload ? payload.analysis : null;
      return { analysis: parseKnowledgeRecallAnalysis(value, question.keyPoints.length), error: null };
    } catch (analysisError) {
      return {
        analysis: null,
        error: analysisError instanceof Error ? analysisError.message : "AI 复核失败，请稍后重试。",
      };
    }
  }

  /**
   * 补做语义复核。仅用于提交时 AI 不可用的补救：分数已经按确定性口径记录，
   * 这里只补回解释，不改动已落库的分数与 Mastery。
   */
  async function handleAiRetry() {
    const answerText = submission?.attempt.mode === "recall" ? submission.attempt.answerText : null;
    if (!answerText?.trim() || aiStatus === "loading") return;

    setAiError(null);
    setAiStatus("loading");
    const { analysis, error: requestError } = await requestAiAnalysis(answerText);
    setAiAnalysis(analysis);
    setAiError(requestError);
    setAiStatus("idle");
  }

  const visibleState = submission?.state ?? state;
  const recallResult = submission?.attempt.mode === "recall" ? submission.attempt : null;
  // 云端增量合并或页面刷新后均从已保存的 Attempt 重建历史，不依赖临时 React state。
  const recallHistory = data ? getKnowledgeRecallHistory(data.attempts, question.id, recallResult) : null;
  const currentAnalysis = recallResult?.aiAnalysis ?? aiAnalysis;
  const supplementalAnalysis = Boolean(recallResult && !recallResult.aiAnalysis && aiAnalysis);
  const showLearn = data !== null && state === null && submission === null;
  const showRecall = state !== null && submission === null;
  const visibleStatus = statusPresentation(visibleState, clock);
  const pauseStartedAt = isPlanPaused(pausePeriods)
    ? Date.parse(getTrainingDayStart(pausePeriods.at(-1)!.start, timeZone))
    : null;
  const nextTask = submission && data ? selectNextTrainingTask({
    currentId: question.id,
    todayKey: getAlgorithmTrainingDateKey(new Date(clock), timeZone),
    now: clock,
    pauseStartedAt,
    tasks: Object.values(data.dailyTasks).flat().map((task) => ({
      id: task.questionId,
      date: task.date,
      status: task.status,
      sortOrder: task.sortOrder,
      taskType: task.taskType,
    })),
    states: Object.values(data.states).map((item) => ({
      id: item.questionId,
      attemptCount: item.attemptCount,
      nextReviewAt: item.nextReviewAt,
    })),
    catalog: plannerQuestions.map((item) => ({
      id: item.id,
      order: item.sourceOrder,
    })),
    preferredTaskType: submission.attempt.mode === "learn" ? "new" : null,
  }) : null;

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex items-center justify-between gap-4 border-b pb-5">
          <Link className="text-sm font-medium text-muted-foreground hover:text-foreground" href="/knowledge">
            ← 返回八股训练
          </Link>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
            {demoMode ? "浏览器演示模式" : "持久数据库"}
          </span>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-5">
            <section>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border bg-card px-2.5 py-1">{question.category}</span>
                <span className="rounded-full border bg-card px-2.5 py-1">{question.topic}</span>
                <span className="rounded-full border bg-card px-2.5 py-1">重要度 {question.importance}</span>
              </div>
              <h1 className="mt-4 text-2xl font-semibold leading-9 tracking-tight sm:text-3xl">
                {question.question}
              </h1>
            </section>

            {data === null ? (
              <section className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">正在读取学习状态…</section>
            ) : showLearn ? (
              <>
                <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Learn · 首次学习</p>
                  <AnswerPanel question={question} />
                  <div className="mt-6 border-t pt-5">
                    <p className="text-sm font-semibold">看完后，你现在理解到什么程度？</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {ratings.map((rating) => (
                        <button
                          className="rounded-xl border bg-card px-3 py-3 text-left transition hover:border-ring hover:bg-muted"
                          key={rating.value}
                          disabled={saving}
                          onClick={() => void submitLearn(rating.value)}
                          type="button"
                        >
                          <span className="block text-sm font-medium">{rating.label}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">初始 {rating.mastery}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            ) : showRecall ? (
              <form className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6" onSubmit={handleRecall}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recall · 主动回忆</p>
                <h2 className="mt-3 font-semibold">先不要看答案</h2>
                <p className="mt-1 text-sm text-muted-foreground">请写下你能记得的关键点。关键词、短句都可以。</p>
                <label className="sr-only" htmlFor="recall-answer">回忆内容</label>
                <textarea
                  className="mt-4 min-h-44 w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm leading-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  id="recall-answer"
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="例如：hash、定位桶、链表、resize…"
                  value={answer}
                />
                <div className="mt-3">
                  <VoiceAnswerButton
                    disabled={saving}
                    onBusyChange={setVoiceBusy}
                    onTranscript={(text) => setAnswer((previous) => (
                      previous.trim() ? `${previous.trimEnd()}\n${text}` : text
                    ))}
                  />
                </div>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button disabled={saving || voiceBusy} onClick={() => void submitRecall("")} type="button" variant="outline">想不起来</Button>
                  <Button disabled={!answer.trim() || saving || voiceBusy} type="submit">{saving ? "保存中…" : "提交回忆"}</Button>
                </div>
              </form>
            ) : submission ? (
              <section className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <p className="font-semibold">{submission.attempt.mode === "learn" ? "首次学习已记录" : "本次回忆已记录"}</p>
                  <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
                    Mastery {submission.state.mastery} · 下次复习 {formatDate(submission.state.nextReviewAt, timeZone)}
                  </p>
                </div>
                {recallResult ? (
                  <>
                    <RecallResult attempt={recallResult} />
                    <div className="rounded-2xl border bg-card p-5 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">AI 语义复核{supplementalAnalysis ? "（补做，未计分）" : currentAnalysis ? "（本次已保存）" : "（本次未能用于计分）"}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {supplementalAnalysis
                              ? "这是提交后的补做解释，没有写入历史 Attempt，也不改变本次分数、Mastery 或复习日期。"
                              : currentAnalysis
                                ? "提交时已同步复核，AI 结果已随本次 Attempt 保存并参与计分。"
                                : "本次提交时复核不可用，已按确定性覆盖率计分；补救复核只补充解释，不改动已记录的分数。"}
                          </p>
                        </div>
                        {currentAnalysis ? null : (
                          <Button
                            disabled={!recallResult.answerText?.trim() || aiStatus === "loading"}
                            onClick={() => void handleAiRetry()}
                            type="button"
                            variant="outline"
                          >
                            {aiStatus === "loading" ? "分析中…" : "补做语义复核"}
                          </Button>
                        )}
                      </div>
                      {aiError ? <p aria-live="assertive" className="mt-3 text-sm text-destructive">{aiError}</p> : null}
                      {currentAnalysis ? (
                        <RecallAiPanel
                          analysis={currentAnalysis}
                          supplemental={supplementalAnalysis}
                          coverageScore={recallResult.coverageScore}
                          effectiveCoverageScore={recallResult.effectiveCoverageScore}
                          question={question}
                        />
                      ) : null}
                    </div>
                  </>
                ) : null}
                <AnswerPanel question={question} />
                <div className="flex flex-wrap gap-3">
                  {nextTask ? (
                    <Link
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                      href={`/knowledge/${nextTask.id}`}
                    >
                      {nextTrainingTaskLabel(nextTask, submission.attempt.mode === "learn")}
                    </Link>
                  ) : (
                    <span className="inline-flex h-9 items-center rounded-lg border border-dashed px-3 text-sm text-muted-foreground">
                      当前没有待完成的下一题
                    </span>
                  )}
                  <Button onClick={() => {
                    setSubmission(null);
                    setAiAnalysis(null);
                    setAiError(null);
                  }} type="button" variant="outline">
                    {submission.attempt.mode === "learn" ? "进入 Recall 模式" : "再回忆一次"}
                  </Button>
                  <Link className="inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium text-muted-foreground hover:bg-muted" href="/knowledge">
                    返回题库
                  </Link>
                </div>
              </section>
            ) : null}

            {recallHistory?.latest ? (
              <RecallHistoryPanel history={recallHistory} timeZone={timeZone} expanded={Boolean(recallResult)} />
            ) : null}

            {error ?? cloud.error ? <p aria-live="assertive" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error ?? cloud.error}</p> : null}

            {question.questionType === "main" && followUps.length > 0 ? (
              <details className="rounded-2xl border bg-card p-5 shadow-sm">
                <summary className="cursor-pointer font-semibold">延伸追问 · {followUps.length} 道</summary>
                <div className="mt-4 space-y-2 border-t pt-4">
                  {followUps.map((followUp) => (
                    <Link className="block rounded-lg px-3 py-2 text-sm leading-6 hover:bg-muted" href={`/knowledge/${followUp.id}`} key={followUp.id}>
                      {followUp.question}
                    </Link>
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">掌握度</p>
                  <p className="mt-2 text-4xl font-semibold">{visibleState?.mastery ?? 0}<span className="ml-1 text-base font-normal text-muted-foreground">/100</span></p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${visibleStatus.className}`}>{visibleStatus.label}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${visibleState?.mastery ?? 0}%` }} />
              </div>
              <dl className="mt-5 space-y-3 border-t pt-4 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Learn</dt><dd>{visibleState?.learnCount ?? 0} 次</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Recall</dt><dd>{visibleState?.recallCount ?? 0} 次</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">下次复习</dt><dd className="text-right">{formatDate(visibleState?.nextReviewAt, timeZone)}</dd></div>
              </dl>
            </div>
            <div className="rounded-2xl border bg-card p-5 text-sm">
              <p className="font-semibold">来源</p>
              <p className="mt-2 leading-6 text-muted-foreground">{question.sourceBook}</p>
              <p className="mt-1 text-xs text-muted-foreground">{question.sourceSection}</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function AnswerPanel({ question }: { question: KnowledgeTrainingQuestion }) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl bg-muted p-4">
        <p className="text-xs font-medium text-muted-foreground">一句话答案</p>
        <p className="mt-2 text-sm leading-7">{question.shortAnswer || "暂无简答"}</p>
      </div>
      <div>
        <h2 className="text-sm font-semibold">面试回答</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground/80">{question.interviewAnswer || "暂无面试答案"}</p>
      </div>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-semibold">展开完整答案</summary>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/80">{question.fullAnswer || "暂无完整答案"}</p>
      </details>
      <div>
        <h2 className="text-sm font-semibold">关键点</h2>
        {question.keyPoints.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm leading-6 text-foreground/80">
            {question.keyPoints.map((point, index) => <li key={`${index}-${point}`}>• {point}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-muted-foreground">本题暂无结构化关键点。</p>}
      </div>
    </div>
  );
}

const verdictLabels: Record<KnowledgeRecallAnalysis["verdict"], string> = {
  excellent: "掌握很好",
  mostly_correct: "大体正确",
  partial: "部分正确",
  incorrect: "需要重学",
};

function RecallAiPanel({
  analysis,
  supplemental = false,
  coverageScore,
  effectiveCoverageScore,
  question,
}: {
  analysis: KnowledgeRecallAnalysis;
  supplemental?: boolean;
  coverageScore: number | null | undefined;
  effectiveCoverageScore: number | null | undefined;
  question: KnowledgeTrainingQuestion;
}) {
  return (
    <div className="mt-4 space-y-4 border-t pt-4 text-sm">
      {supplemental ? (
        <p className="rounded-xl bg-muted p-4 leading-6">本次实际计分仍为 {effectiveCoverageScore ?? coverageScore ?? 0}%；补做 AI 语义覆盖率为 {analysis.semanticScore}%，仅供理解和自查，未改变历史分数。</p>
      ) : (
        <RecallScoreComparison
          coverageScore={coverageScore}
          effectiveCoverageScore={effectiveCoverageScore}
          semanticScore={analysis.semanticScore}
          verdictLabel={verdictLabels[analysis.verdict]}
        />
      )}
      <div className="rounded-xl bg-muted p-4">
        <p className="font-medium">复核结论</p>
        <p className="mt-1 leading-6 text-muted-foreground">{analysis.summary}</p>
      </div>
      {analysis.coveredPoints.length > 0 ? (
        <div>
          <p className="font-medium text-emerald-700 dark:text-emerald-400">语义已覆盖</p>
          <ul className="mt-2 space-y-2 leading-6">
            {analysis.coveredPoints.map((point) => (
              <li key={point.index}>✓ {question.keyPoints[point.index]} — <span className="text-muted-foreground">{point.evidence}</span></li>
            ))}
          </ul>
        </div>
      ) : null}
      {analysis.missingPoints.length > 0 ? (
        <div>
          <p className="font-medium text-amber-700 dark:text-amber-400">建议补充</p>
          <ul className="mt-2 space-y-2 leading-6">
            {analysis.missingPoints.map((point) => (
              <li key={point.index}>△ {question.keyPoints[point.index]} — <span className="text-muted-foreground">{point.guidance}</span></li>
            ))}
          </ul>
        </div>
      ) : null}
      {analysis.misconceptions.length > 0 ? (
        <div>
          <p className="font-medium text-destructive">需要纠正</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {analysis.misconceptions.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="font-medium">更完整的面试表达</p>
        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-muted p-4 leading-7">{analysis.improvedAnswer}</p>
      </div>
    </div>
  );
}
