import { redirect } from "next/navigation";
import { signOut } from "@/app/dashboard/actions";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { Button } from "@/components/ui/button";
import { algorithmCatalog, toAlgorithmPlannerProblem } from "@/lib/algorithm/catalog";
import {
  knowledgeQuestions,
  knowledgeTopics,
  toKnowledgePlannerQuestion,
} from "@/lib/knowledge/catalog";
import { isBrowserDemoMode, isLocalDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const localMode = isLocalDemoMode();
  const demoMode = isBrowserDemoMode();

  if (!localMode) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    if (!data?.claims) {
      redirect("/login");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between border-b pb-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">秋招训练工作台</h1>
        </div>
        {localMode ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
            {demoMode ? "浏览器演示模式" : "本地数据库模式"}
          </span>
        ) : (
          <form action={signOut}>
            <Button type="submit" variant="outline">退出登录</Button>
          </form>
        )}
      </header>

      <DashboardOverview
        algorithmProblems={algorithmCatalog.map(toAlgorithmPlannerProblem)}
        demoMode={demoMode}
        knowledgeQuestions={knowledgeQuestions.map((question) => ({
          ...toKnowledgePlannerQuestion(question),
          topicId: question.topicId,
        }))}
        topics={knowledgeTopics.map(({ id, name, category }) => ({ id, name, category }))}
      />
    </main>
  );
}
