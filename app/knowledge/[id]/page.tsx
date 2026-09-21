import { notFound } from "next/navigation";

import {
  KnowledgeTraining,
  type KnowledgeTrainingQuestion,
} from "@/components/knowledge/knowledge-training";
import {
  getKnowledgeFollowUps,
  getKnowledgeQuestion,
  knowledgeQuestions,
  toKnowledgePlannerQuestion,
} from "@/lib/knowledge/catalog";
import { isBrowserDemoMode } from "@/lib/supabase/env";

export function generateStaticParams() {
  return knowledgeQuestions
    .filter((question) => question.isCore6Weeks)
    .map((question) => ({ id: question.id }));
}

function trainingQuestion(question: NonNullable<ReturnType<typeof getKnowledgeQuestion>>): KnowledgeTrainingQuestion {
  return {
    id: question.id,
    category: question.category,
    topic: question.topic,
    question: question.question,
    questionType: question.questionType,
    importance: question.importance,
    shortAnswer: question.shortAnswer,
    interviewAnswer: question.interviewAnswer,
    fullAnswer: question.fullAnswer,
    keyPoints: question.keyPoints,
    keywordAliases: question.keywordAliases,
    keyPointWeights: question.keyPointWeights,
    sourceBook: question.sourceBook,
    sourceSection: question.sourceSection,
  };
}

export default async function KnowledgeQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const question = getKnowledgeQuestion(id);
  if (!question) notFound();

  return (
    <KnowledgeTraining
      key={question.id}
      demoMode={isBrowserDemoMode()}
      followUps={getKnowledgeFollowUps(question.id).map((followUp) => ({
        id: followUp.id,
        question: followUp.question,
      }))}
      plannerQuestions={knowledgeQuestions.map(toKnowledgePlannerQuestion)}
      question={trainingQuestion(question)}
    />
  );
}
