import { redirect } from "next/navigation";

import {
  KnowledgeOverview,
  type KnowledgeOverviewQuestion,
} from "@/components/knowledge/knowledge-overview";
import {
  knowledgeQuestions,
  knowledgeTopics,
  toKnowledgePlannerQuestion,
} from "@/lib/knowledge/catalog";
import { isBrowserDemoMode, isLocalDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function KnowledgePage() {
  const localMode = isLocalDemoMode();
  const demoMode = isBrowserDemoMode();
  if (!localMode) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) redirect("/login");
  }

  const questions: KnowledgeOverviewQuestion[] = knowledgeQuestions.map((question) => ({
    id: question.id,
    topicId: question.topicId,
    question: question.question,
    questionType: question.questionType,
    importance: question.importance,
    isCore6Weeks: question.isCore6Weeks,
  }));

  return (
    <KnowledgeOverview
      demoMode={demoMode}
      plannerQuestions={knowledgeQuestions.map(toKnowledgePlannerQuestion)}
      questions={questions}
      topics={knowledgeTopics}
    />
  );
}
