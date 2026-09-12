import { redirect } from "next/navigation";
import Link from "next/link";

import {
  ProgressOverview,
  type ProgressAlgorithmProblem,
  type ProgressKnowledgeQuestion,
} from "@/components/progress/progress-overview";
import { algorithmCatalog } from "@/lib/algorithm/catalog";
import { knowledgeQuestions, knowledgeTopics } from "@/lib/knowledge/catalog";
import { isBrowserDemoMode, isLocalDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function ProgressPage() {
  const localMode = isLocalDemoMode();
  const demoMode = isBrowserDemoMode();
  if (!localMode) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) redirect("/login");
  }

  const algorithmProblems: ProgressAlgorithmProblem[] = algorithmCatalog.map((problem) => ({
    id: problem.id,
    tags: problem.tags,
    importance: problem.importance,
  }));
  const questions: ProgressKnowledgeQuestion[] = knowledgeQuestions.map((question) => ({
    id: question.id,
    topicId: question.topicId,
    category: question.category,
    questionType: question.questionType,
    importance: question.importance,
    isCore6Weeks: question.isCore6Weeks,
  }));

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link className="text-sm font-medium text-muted-foreground hover:text-foreground" href="/dashboard">
              ← Dashboard
            </Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">训练进度</h1>
            <p className="mt-2 text-sm text-muted-foreground">只看覆盖、掌握度、到期复习和真实薄弱项。</p>
          </div>
          <span className="w-fit rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
            {localMode ? (demoMode ? "浏览器 Demo" : "本地 SQLite") : "Supabase 云端"}
          </span>
        </header>
        <ProgressOverview
          algorithmProblems={algorithmProblems}
          demoMode={demoMode}
          knowledgeQuestions={questions}
          knowledgeTopics={knowledgeTopics.map(({ id, name, category }) => ({ id, name, category }))}
        />
      </div>
    </main>
  );
}
