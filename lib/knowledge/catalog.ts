import fullKnowledge from "../../data/knowledge/offerpilot_bagu_full.json";
import coreKnowledge from "../../data/knowledge/offerpilot_bagu_core_6weeks.json";

import type {
  KnowledgeKeywordAliases,
  KnowledgePointWeights,
} from "./match";
import type { KnowledgePlannerQuestion } from "../planner/knowledge";

export type KnowledgeCatalogTopic = {
  id: string;
  name: string;
  category: string;
  importance: number;
  recommendedWeek: number | null;
  questionCount: number;
  mainQuestionCount: number;
};

export type KnowledgeCatalogQuestion = {
  id: string;
  topicId: string;
  category: string;
  section: string;
  topic: string;
  question: string;
  questionType: "main" | "follow_up";
  importance: number;
  difficulty: "easy" | "medium" | "hard" | "unknown";
  answerStatus: "available" | "container_only";
  shortAnswer: string;
  interviewAnswer: string;
  fullAnswer: string;
  keyPoints: readonly string[];
  keywordAliases: KnowledgeKeywordAliases;
  keyPointWeights: KnowledgePointWeights;
  parentId: string | null;
  sourceBook: string;
  sourceSection: string;
  sourceOrder: number;
  isCore6Weeks: boolean;
  scheduled: boolean;
  coreFollowups: readonly unknown[];
};

const CATEGORY_WEEK: Readonly<Record<string, number>> = {
  Java基础: 1,
  Java集合: 1,
  Java并发: 2,
  JVM: 3,
  Spring: 4,
  MySQL: 4,
  Redis: 4,
};

const coreById = new Map(
  coreKnowledge.questions.map((question) => [question.id, question]),
);

export const knowledgeTopics: readonly KnowledgeCatalogTopic[] =
  fullKnowledge.topics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    category: topic.category,
    importance: topic.importance,
    recommendedWeek: CATEGORY_WEEK[topic.category] ?? null,
    questionCount: topic.question_count,
    mainQuestionCount: topic.main_question_count,
  }));

export const knowledgeQuestions: readonly KnowledgeCatalogQuestion[] =
  fullKnowledge.questions.map((question) => {
    const core = coreById.get(question.id);
    return {
      id: question.id,
      topicId: question.topic_id,
      category: question.category,
      section: question.section,
      topic: question.topic,
      question: question.question,
      questionType: question.question_type as "main" | "follow_up",
      importance: question.importance,
      difficulty: question.difficulty as KnowledgeCatalogQuestion["difficulty"],
      answerStatus: question.answer_status as KnowledgeCatalogQuestion["answerStatus"],
      shortAnswer: question.short_answer,
      interviewAnswer: question.interview_answer,
      fullAnswer: question.full_answer,
      keyPoints: question.key_points,
      keywordAliases: question.keyword_aliases as KnowledgeKeywordAliases,
      keyPointWeights: Object.fromEntries(
        question.key_points.map((_, index) => [String(index), index === 0 ? 20 : 5]),
      ),
      parentId: question.parent_id,
      sourceBook: question.source_book,
      sourceSection: question.source_section,
      sourceOrder: question.source_order,
      isCore6Weeks: core !== undefined,
      scheduled: core?.scheduled ?? false,
      coreFollowups: core?.core_followups ?? [],
    };
  });

const questionsById = new Map(
  knowledgeQuestions.map((question) => [question.id, question]),
);

export function getKnowledgeQuestion(id: string) {
  return questionsById.get(id);
}

export function getKnowledgeFollowUps(parentId: string) {
  return knowledgeQuestions.filter((question) => question.parentId === parentId);
}

export function toKnowledgePlannerQuestion(
  question: KnowledgeCatalogQuestion,
): KnowledgePlannerQuestion {
  return {
    id: question.id,
    questionType: question.questionType,
    isCore6Weeks: question.isCore6Weeks,
    recommendedWeek: CATEGORY_WEEK[question.category] ?? null,
    importance: question.importance,
    sourceOrder: question.sourceOrder,
  };
}
