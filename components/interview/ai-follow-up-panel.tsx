"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  fallbackInterviewFollowUp,
  type InterviewFollowUp,
} from "@/lib/interview/ai-coach";
import { requestInterviewFollowUp } from "@/lib/interview/ai-coach-client";
import type { InterviewQuestion, InterviewResponse } from "@/lib/interview/session";

export type InterviewFollowUpNote = {
  questionId: string;
  followUpQuestion: string;
  answerText: string;
  skipped: boolean;
  source: InterviewFollowUp["source"];
  focusPointIndex: number | null;
};

export function AiInterviewFollowUpPanel({
  question,
  response,
  priorFollowUps = [],
  onComplete,
}: {
  question: InterviewQuestion;
  response: InterviewResponse;
  priorFollowUps?: readonly string[];
  onComplete: (note: InterviewFollowUpNote) => void;
}) {
  const [followUp, setFollowUp] = useState<InterviewFollowUp | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    completedRef.current = false;

    const fallbackInput = {
      question: question.question,
      answer: response.answerText,
      keyPoints: question.keyPoints,
      missingPoints: response.missingPoints.map(({ index, point }) => ({ index, point })),
      priorFollowUps,
    };

    void requestInterviewFollowUp({
      questionId: question.id,
      answerText: response.answerText,
      priorFollowUps,
      fallbackInput,
    }, fetch, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setFollowUp(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFollowUp(fallbackInterviewFollowUp(fallbackInput));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [priorFollowUps, question, response]);

  function finish(skipped: boolean) {
    if (!followUp || completedRef.current) return;
    if (!skipped && !answer.trim()) {
      setError("请回答追问，或选择跳过追问。");
      return;
    }
    completedRef.current = true;
    onComplete({
      questionId: question.id,
      followUpQuestion: followUp.question,
      answerText: skipped ? "" : answer.trim(),
      skipped,
      source: followUp.source,
      focusPointIndex: followUp.focusPointIndex,
    });
  }

  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Interviewer · Follow-up
          </p>
          <h2 className="mt-2 text-xl font-semibold">面试官追问</h2>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
          {followUp?.source === "ai" ? "AI 追问" : "确定性追问"}
        </span>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">正在根据你的回答生成一条追问…</p>
      ) : followUp ? (
        <>
          <p className="mt-6 text-lg font-medium leading-relaxed">{followUp.question}</p>
          <p className="mt-2 text-xs text-muted-foreground">{followUp.rationale}</p>
          <textarea
            className="mt-5 min-h-36 w-full resize-y rounded-xl border bg-background p-4 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            maxLength={3_000}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="回答这条追问；追问内容只用于本场面试，不会改变主问题得分。"
            value={answer}
          />
          {error ? (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => finish(false)} type="button">
              提交追问，下一题
            </Button>
            <Button onClick={() => finish(true)} type="button" variant="outline">
              跳过追问
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">追问生成失败，可切换到确定性追问继续。</p>
          <Button
            className="mt-4"
            onClick={() => {
              setFollowUp(fallbackInterviewFollowUp({
                question: question.question,
                answer: response.answerText,
                keyPoints: question.keyPoints,
                missingPoints: response.missingPoints.map(({ index, point }) => ({ index, point })),
                priorFollowUps,
              }));
            }}
            type="button"
            variant="outline"
          >
            使用确定性追问
          </Button>
        </div>
      )}
    </section>
  );
}
