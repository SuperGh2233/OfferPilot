"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { KnowledgeUnderstanding } from "@/lib/ai/knowledge-understanding";

type UnderstandingCoachProps = {
  questionId: string;
};

export function UnderstandingCoach({
  questionId,
}: UnderstandingCoachProps) {
  const [confusionText, setConfusionText] = useState("");
  const [explanation, setExplanation] = useState<KnowledgeUnderstanding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function explain() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/explain-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, confusionText }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "理解教练暂时不可用，请先阅读原答案。";
        throw new Error(message);
      }
      if (!payload || typeof payload !== "object" || !("explanation" in payload)) {
        throw new Error("理解教练返回内容无效，请重试。");
      }
      setExplanation(payload.explanation as KnowledgeUnderstanding);
    } catch (requestError) {
      setExplanation(null);
      setError(requestError instanceof Error ? requestError.message : "理解教练暂时不可用，请重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details
      className="rounded-xl border border-dashed p-4"
      onToggle={(event) => {
        if (!event.currentTarget.open) {
          setExplanation(null);
          setError(null);
        }
      }}
    >
      <summary className="cursor-pointer text-sm font-semibold">看了答案还是不懂？让 AI 换一种讲法</summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          它会先讲直觉，再拆步骤和例子；不会提交学习结果。你也可以告诉它卡在哪个词。
        </p>
        <label className="block text-sm font-medium" htmlFor="understanding-confusion">
          哪里卡住了（可选）
          <textarea
            className="mt-2 min-h-20 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            id="understanding-confusion"
            maxLength={500}
            onChange={(event) => setConfusionText(event.target.value)}
            placeholder="例如：我不明白为什么要扩容，或者不知道这一步什么时候发生。"
            value={confusionText}
          />
        </label>
        <Button disabled={loading} onClick={() => void explain()} type="button" variant="outline">
          {loading ? "正在换一种讲法…" : explanation ? "再讲一次" : "用白话重新讲"}
        </Button>
        {error ? <p aria-live="assertive" className="text-sm text-destructive">{error}</p> : null}
        {explanation ? (
          <div aria-live="polite" className="space-y-4 border-t pt-4 text-sm">
            <div className="rounded-xl bg-muted p-4">
              <p className="font-semibold">先抓住核心</p>
              <p className="mt-2 leading-7">{explanation.coreIdea}</p>
            </div>
            {explanation.prerequisites.length > 0 ? (
              <div>
                <p className="font-semibold">先认识这些词</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
                  {explanation.prerequisites.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ) : null}
            <div>
              <p className="font-semibold">用一个直觉理解</p>
              <p className="mt-2 leading-7 text-muted-foreground">{explanation.analogy}</p>
            </div>
            <div>
              <p className="font-semibold">一步一步看</p>
              <ol className="mt-2 space-y-2">
                {explanation.steps.map((step, index) => (
                  <li className="rounded-lg bg-muted/60 p-3" key={`${step.title}-${index}`}>
                    <p className="font-medium">{index + 1}. {step.title}</p>
                    <p className="mt-1 leading-6 text-muted-foreground">{step.detail}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-semibold">小例子</p>
              <p className="mt-2 whitespace-pre-wrap leading-7">{explanation.example}</p>
            </div>
            <div>
              <p className="font-semibold">先记住这几句</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
                {explanation.takeaways.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            {explanation.selfCheck.length > 0 ? (
              <div>
                <p className="font-semibold">现在自己说一遍</p>
                <div className="mt-2 space-y-2">
                  {explanation.selfCheck.map((item) => (
                    <details className="rounded-lg border p-3" key={item.question}>
                      <summary className="cursor-pointer leading-6">{item.question}</summary>
                      <p className="mt-2 leading-6 text-muted-foreground">参考：{item.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
