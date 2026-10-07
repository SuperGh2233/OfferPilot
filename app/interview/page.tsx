import { redirect } from "next/navigation";

import { InterviewSimulator } from "@/components/interview/interview-simulator";
import {
  knowledgeQuestions,
  knowledgeTopicDependencyGraph,
  knowledgeTopics,
  toKnowledgePlannerQuestion,
} from "@/lib/knowledge/catalog";
import { isBrowserDemoMode, isLocalDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function InterviewPage() {
  const localMode = isLocalDemoMode();
  const demoMode = isBrowserDemoMode();

  if (!localMode) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) redirect("/login");
  }

  return (
    <InterviewSimulator
      demoMode={demoMode}
      dependencyNodes={knowledgeTopicDependencyGraph.nodes.map((node) => ({
        topicId: node.topicId,
        prerequisiteTopicIds: node.prerequisiteTopicIds,
      }))}
      questions={knowledgeQuestions.map((question) => {
        const planner = toKnowledgePlannerQuestion(question);
        return {
          id: question.id,
          topicId: question.topicId,
          category: question.category,
          topic: question.topic,
          question: question.question,
          questionType: question.questionType,
          importance: question.importance,
          isCore6Weeks: question.isCore6Weeks,
          sourceOrder: question.sourceOrder,
          prerequisiteTopicIds: planner.prerequisiteTopicIds,
          topicDepth: planner.topicDepth,
          keyPoints: question.keyPoints,
          keywordAliases: question.keywordAliases,
          keyPointWeights: question.keyPointWeights,
        };
      })}
      topics={knowledgeTopics.map(({ id, name, category }) => ({ id, name, category }))}
    />
  );
}
