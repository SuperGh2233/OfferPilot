"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AiInterviewFollowUpPanel,
  type InterviewFollowUpNote,
} from "@/components/interview/ai-follow-up-panel";
import { AiInterviewSummaryCard } from "@/components/interview/ai-summary-card";
import { Button } from "@/components/ui/button";
import {
  buildInterviewPlan,
  buildInterviewReport,
  scoreInterviewAnswer,
  type InterviewDependencyNode,
  type InterviewPlanItem,
  type InterviewQuestion,
  type InterviewReport,
  type InterviewResponse,
} from "@/lib/interview/session";
import {
  loadKnowledgeDemoData,
  type KnowledgeDemoData,
} from "@/lib/knowledge/demo-store";
import type { CloudTrainingSnapshot } from "@/lib/supabase/training";
import { useCloudTrainingSnapshot } from "@/lib/supabase/use-cloud-training";

const reasonLabel = {
  overdue: "到期复习",
  weakness: "薄弱知识",
  retention: "保持熟练",
  stretch: "已解锁挑战",
} as const;

export function InterviewSimulator({
  demoMode,
  dependencyNodes,
  questions,
  topics,
}: {
  demoMode: boolean;
  dependencyNodes: readonly InterviewDependencyNode[];
  questions: readonly InterviewQuestion[];
  topics: readonly { id: string; name: string; category: string }[];
}) {
  const [data, setData] = useState<KnowledgeDemoData | null>(null);
  const [plan, setPlan] = useState<InterviewPlanItem[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [responses, setResponses] = useState<InterviewResponse[]>([]);
  const [pendingResponse, setPendingResponse] = useState<InterviewResponse | null>(null);
  const [followUpNotes, setFollowUpNotes] = useState<InterviewFollowUpNote[]>([]);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  const applyCloudSnapshot = useCallback((snapshot: CloudTrainingSnapshot) => {
    setData(snapshot.knowledge);
  }, []);
  const cloud = useCloudTrainingSnapshot(!demoMode, applyCloudSnapshot);

  useEffect(() => {
    if (!demoMode) return;
    const initialLoad = window.setTimeout(() => {
      try {
        setData(loadKnowledgeDemoData(window.localStorage));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "读取本地面试数据失败。");
      }
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [demoMode]);

  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const topicById = useMemo(
    () => new Map(topics.map((topic) => [topic.id, topic])),
    [topics],
  );

  const currentItem = plan?.[currentIndex] ?? null;
  const currentQuestion = currentItem ? questionById.get(currentItem.questionId) ?? null : null;

  const report: InterviewReport | null = useMemo(() => {
    if (!finished || !data || responses.length === 0) return null;
    return buildInterviewReport({
      responses,
      dependencyNodes,
      questions,
      states: Object.values(data.states),
    });
  }, [data, dependencyNodes, finished, questions, responses]);

  function startInterview() {
    if (!data) return;
    const nextPlan = buildInterviewPlan({
      questions,
      states: Object.values(data.states),
      now: Date.now(),
      size: 5,
    });
    if (nextPlan.length === 0) {
      setError("当前没有可用于模拟面试的核心题，请先完成一些八股学习。");
      return;
    }
    setError(null);
    setPlan(nextPlan);
    setCurrentIndex(0);
    setAnswer("");
    setResponses([]);
    setPendingResponse(null);
    setFollowUpNotes([]);
    submitLockRef.current = false;
    setFinished(false);
  }

  function finishMainQuestion(response: InterviewResponse) {
    if (!plan) return;
    submitLockRef.current = false;
    setResponses((current) => [...current, response]);
    setPendingResponse(null);
    setError(null);
    setAnswer("");

    if (currentIndex >= plan.length - 1) {
      setFinished(true);
      return;
    }
    setCurrentIndex((index) => index + 1);
  }

  function submitCurrent(skip = false) {
    if (!currentQuestion || !plan || pendingResponse || submitLockRef.current) return;
    if (!skip && !answer.trim()) {
      setError("请先回答，或选择跳过本题。");
      return;
    }

    submitLockRef.current = true;
    const response = scoreInterviewAnswer(currentQuestion, skip ? "" : answer);
    setError(null);

    if (skip) {
      finishMainQuestion(response);
      return;
    }

    // Freeze the deterministic main-question score before any AI follow-up.
    // The follow-up answer is never passed back into scoreInterviewAnswer().
    setPendingResponse(response);
  }

  function restartInterview() {
    setPlan(null);
    setCurrentIndex(0);
    setAnswer("");
    setResponses([]);
    setPendingResponse(null);
    setFollowUpNotes([]);
    submitLockRef.current = false;
    setFinished(false);
    setError(null);
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-10">
        <p className="text-sm text-muted-foreground">
          {cloud.error ?? error ?? "正在读取你的知识图谱与掌握状态…"}
        </p>
      </main>
    );
  }

  if (report && plan) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Mock Interview · Sprint 3</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">模拟面试能力报告</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              本场结果只用于评估，不会直接改写日常 Mastery 或复习时间。
            </p>
          </div>
          <div className="rounded-2xl border bg-card px-6 py-4 text-center">
            <p className="text-xs text-muted-foreground">本场总分</p>
            <p className="mt-1 text-4xl font-semibold">{report.overallScore}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              回答 {report.answered} · 跳过 {report.skipped}
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">领域表现</h2>
            <div className="mt-4 space-y-3">
              {report.categories.map((category) => (
                <div key={category.category}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{category.category}</span>
                    <span className="font-medium">{category.score}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    回答 {category.answered}/{category.total}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">优先回补</h2>
            <div className="mt-4 space-y-3">
              {report.recommendedTopicIds.length > 0 ? report.recommendedTopicIds.map((topicId) => {
                const topic = topicById.get(topicId);
                return (
                  <div className="rounded-xl border bg-muted/20 px-3 py-2" key={topicId}>
                    <p className="text-sm font-medium">{topic?.name ?? topicId}</p>
                    <p className="text-xs text-muted-foreground">{topic?.category ?? "知识图谱前置节点"}</p>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground">本场没有明显需要回补的 Topic。</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">薄弱 Topic</h2>
            <div className="mt-4 space-y-2">
              {report.weakestTopics.map((topic) => (
                <div className="flex items-center justify-between gap-4 text-sm" key={topic.topicId}>
                  <span>{topic.category} · {topic.topic}</span>
                  <span className="font-medium">{topic.score}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">本场遗漏关键点</h2>
            {report.missingPoints.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {report.missingPoints.map((point) => <li key={point}>• {point}</li>)}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">本场没有检测到关键点遗漏。</p>
            )}
          </div>
        </section>

        <AiInterviewSummaryCard
          report={report}
          recommendedTopicNames={report.recommendedTopicIds.map(
            (topicId) => topicById.get(topicId)?.name ?? topicId,
          )}
        />

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">逐题结果</h2>
          <div className="mt-4 space-y-4">
            {responses.map((response, index) => (
              <article className="rounded-xl border p-4" key={response.questionId}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      第 {index + 1} 题 · {response.category} / {response.topic}
                    </p>
                    <p className="mt-1 font-medium">
                      {questionById.get(response.questionId)?.question}
                    </p>
                  </div>
                  <span className="text-lg font-semibold">{response.score}%</span>
                </div>
                {response.skipped ? (
                  <p className="mt-3 text-sm text-muted-foreground">本题已跳过。</p>
                ) : response.missingPoints.length > 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    主要遗漏：{response.missingPoints.slice(0, 3).map((point) => point.point).join("；")}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">关键点覆盖完整。</p>
                )}
              </article>
            ))}
          </div>
        </section>

        {followUpNotes.length > 0 ? (
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">追问记录（不计分）</h2>
            <div className="mt-4 space-y-4">
              {followUpNotes.map((note, index) => (
                <article className="rounded-xl border p-4" key={`${note.questionId}:${index}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium">{note.followUpQuestion}</p>
                    <span className="text-xs text-muted-foreground">
                      {note.source === "ai" ? "AI 追问" : "确定性追问"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {note.skipped ? "本条追问已跳过。" : note.answerText}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button onClick={restartInterview} type="button">再来一场</Button>
          <Link className="inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium" href="/dashboard">
            返回 Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="border-b pb-5">
          <p className="text-sm font-medium text-muted-foreground">Mock Interview · Sprint 3</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">图谱驱动模拟面试</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            系统会根据你的现有 Mastery、到期状态和 prerequisite DAG 选 5 道题：
            优先薄弱和到期知识，再加入已经解锁的挑战题。同一 Topic 默认只抽一题。
          </p>
        </header>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">本场规则</h2>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <p>• 支持文本输入，可使用系统听写。</p>
            <p>• 不展示参考答案，直到整场结束。</p>
            <p>• 评分复用现有关键点匹配，AI 不决定 Mastery。</p>
            <p>• 本场不会完成日常任务，也不会改变复习日期。</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={startInterview} type="button">开始 5 题模拟面试</Button>
            <Link className="inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium" href="/dashboard">
              返回 Dashboard
            </Link>
          </div>
          {(error || cloud.error) ? (
            <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error ?? cloud.error}</p>
          ) : null}
        </section>
      </main>
    );
  }

  if (!currentItem || !currentQuestion) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-10">
        <p className="text-sm text-rose-600">面试题加载失败，请重新开始。</p>
        <Button className="mt-4 w-fit" onClick={restartInterview} type="button">重新开始</Button>
      </main>
    );
  }

  if (pendingResponse) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="border-b pb-5">
          <p className="text-sm font-medium text-muted-foreground">
            第 {currentIndex + 1} / {plan.length} 题 · 追问
          </p>
          <h1 className="mt-1 text-xl font-semibold">
            {currentItem.category} · {currentItem.topic}
          </h1>
        </header>
        <AiInterviewFollowUpPanel
          key={`${currentQuestion.id}:${pendingResponse.answerText}`}
          onComplete={(note) => {
            const response = pendingResponse;
            setFollowUpNotes((current) => [...current, note]);
            finishMainQuestion(response);
          }}
          priorFollowUps={followUpNotes
            .filter((note) => note.questionId === currentQuestion.id)
            .map((note) => note.followUpQuestion)}
          question={currentQuestion}
          response={pendingResponse}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="border-b pb-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              第 {currentIndex + 1} / {plan.length} 题
            </p>
            <h1 className="mt-1 text-xl font-semibold">{currentItem.category} · {currentItem.topic}</h1>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
            {reasonLabel[currentItem.reason]}
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.round((currentIndex + 1) / plan.length * 100)}%` }}
          />
        </div>
      </header>

      <section className="rounded-2xl border bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Interviewer</p>
        <h2 className="mt-3 text-xl font-semibold leading-relaxed">{currentQuestion.question}</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          按真实面试方式回答。系统不会在本题提交后立即展示参考答案，避免影响后续题。
        </p>

        <textarea
          className="mt-6 min-h-48 w-full resize-y rounded-xl border bg-background p-4 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          maxLength={5000}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="输入你的回答…"
          value={answer}
        />

        {error ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => submitCurrent(false)} type="button">
            提交，进入追问
          </Button>
          <Button onClick={() => submitCurrent(true)} type="button" variant="outline">
            跳过本题
          </Button>
        </div>
      </section>
    </main>
  );
}
