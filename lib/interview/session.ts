import {
  matchKnowledgeKeyPoints,
  type KnowledgeKeywordAliases,
  type KnowledgeMatchResult,
  type KnowledgePointWeights,
} from "../knowledge/match";
import {
  knowledgePrerequisitesSatisfied,
  satisfiedKnowledgeTopics,
  type KnowledgeReadinessQuestion,
  type KnowledgeReadinessState,
} from "../knowledge-graph/readiness";

export type InterviewQuestion = KnowledgeReadinessQuestion & {
  id: string;
  topicId: string;
  category: string;
  topic: string;
  question: string;
  questionType: "main" | "follow_up";
  importance: number;
  isCore6Weeks: boolean;
  sourceOrder: number;
  prerequisiteTopicIds?: readonly string[];
  topicDepth?: number;
  keyPoints: readonly string[];
  keywordAliases: KnowledgeKeywordAliases;
  keyPointWeights: KnowledgePointWeights;
};

export type InterviewQuestionState = KnowledgeReadinessState & {
  nextReviewAt: string | null;
};

export type InterviewPlanReason = "overdue" | "weakness" | "retention" | "stretch";

export type InterviewPlanItem = {
  questionId: string;
  topicId: string;
  category: string;
  topic: string;
  question: string;
  reason: InterviewPlanReason;
  masteryBefore: number | null;
};

export type InterviewResponse = {
  questionId: string;
  topicId: string;
  category: string;
  topic: string;
  answerText: string;
  skipped: boolean;
  score: number;
  matchedPoints: KnowledgeMatchResult["matchedPoints"];
  missingPoints: KnowledgeMatchResult["missingPoints"];
};

export type InterviewCategoryReport = {
  category: string;
  score: number;
  answered: number;
  total: number;
};

export type InterviewTopicReport = {
  topicId: string;
  topic: string;
  category: string;
  score: number;
};

export type InterviewReport = {
  overallScore: number;
  answered: number;
  skipped: number;
  categories: readonly InterviewCategoryReport[];
  strongestTopics: readonly InterviewTopicReport[];
  weakestTopics: readonly InterviewTopicReport[];
  missingPoints: readonly string[];
  recommendedTopicIds: readonly string[];
};

export type InterviewDependencyNode = {
  topicId: string;
  prerequisiteTopicIds: readonly string[];
};

function parseReviewAt(value: string | null) {
  if (value === null) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function reasonRank(reason: InterviewPlanReason) {
  if (reason === "overdue") return 0;
  if (reason === "weakness") return 1;
  if (reason === "stretch") return 2;
  return 3;
}

function classifyQuestion(
  question: InterviewQuestion,
  state: InterviewQuestionState | undefined,
  now: number,
  satisfiedTopics: ReadonlySet<string>,
): InterviewPlanReason | null {
  if (question.questionType !== "main" || !question.isCore6Weeks || question.keyPoints.length === 0) {
    return null;
  }

  if (state && state.attemptCount > 0) {
    if (parseReviewAt(state.nextReviewAt) <= now) return "overdue";
    if (state.mastery < 60) return "weakness";
    return "retention";
  }

  if (knowledgePrerequisitesSatisfied(question.prerequisiteTopicIds, satisfiedTopics)) {
    return "stretch";
  }
  return null;
}

export function buildInterviewPlan({
  questions,
  states,
  now = Date.now(),
  size = 5,
}: {
  questions: readonly InterviewQuestion[];
  states: readonly InterviewQuestionState[];
  now?: number;
  size?: number;
}): InterviewPlanItem[] {
  if (!Number.isSafeInteger(size) || size < 1 || size > 20) {
    throw new RangeError("interview size must be between 1 and 20");
  }
  if (!Number.isFinite(now)) throw new RangeError("interview now must be finite");

  const stateByQuestionId = new Map(states.map((state) => [state.questionId, state]));
  const satisfiedTopics = satisfiedKnowledgeTopics(questions, states);
  const candidates = questions
    .map((question, index) => {
      const state = stateByQuestionId.get(question.id);
      const reason = classifyQuestion(question, state, now, satisfiedTopics);
      return reason ? { question, state, reason, index } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      const reasonDiff = reasonRank(left.reason) - reasonRank(right.reason);
      if (reasonDiff !== 0) return reasonDiff;

      if (left.reason === "overdue" && right.reason === "overdue") {
        const dueDiff = parseReviewAt(left.state?.nextReviewAt ?? null)
          - parseReviewAt(right.state?.nextReviewAt ?? null);
        if (dueDiff !== 0) return dueDiff;
      }

      const leftMastery = left.state?.mastery ?? 0;
      const rightMastery = right.state?.mastery ?? 0;
      if (left.reason !== "stretch" && right.reason !== "stretch" && leftMastery !== rightMastery) {
        return leftMastery - rightMastery;
      }

      return (left.question.topicDepth ?? 0) - (right.question.topicDepth ?? 0)
        || right.question.importance - left.question.importance
        || left.question.sourceOrder - right.question.sourceOrder
        || left.index - right.index;
    });

  const selected: typeof candidates = [];
  const selectedQuestionIds = new Set<string>();
  const selectedTopicIds = new Set<string>();

  for (const candidate of candidates) {
    if (selected.length >= size) break;
    if (selectedTopicIds.has(candidate.question.topicId)) continue;
    selected.push(candidate);
    selectedQuestionIds.add(candidate.question.id);
    selectedTopicIds.add(candidate.question.topicId);
  }

  if (selected.length < size) {
    for (const candidate of candidates) {
      if (selected.length >= size) break;
      if (selectedQuestionIds.has(candidate.question.id)) continue;
      selected.push(candidate);
      selectedQuestionIds.add(candidate.question.id);
    }
  }

  return selected.map(({ question, state, reason }) => ({
    questionId: question.id,
    topicId: question.topicId,
    category: question.category,
    topic: question.topic,
    question: question.question,
    reason,
    masteryBefore: state?.attemptCount ? state.mastery : null,
  }));
}

export function scoreInterviewAnswer(
  question: InterviewQuestion,
  answerText: string,
): InterviewResponse {
  const answer = answerText.trim();
  if (!answer) {
    return {
      questionId: question.id,
      topicId: question.topicId,
      category: question.category,
      topic: question.topic,
      answerText: "",
      skipped: true,
      score: 0,
      matchedPoints: [],
      missingPoints: question.keyPoints.map((point, index) => ({
        index,
        point,
        weight: question.keyPointWeights[String(index)] ?? (index === 0 ? 20 : 5),
      })),
    };
  }

  const match = matchKnowledgeKeyPoints({
    answer,
    keyPoints: question.keyPoints,
    keywordAliases: question.keywordAliases,
    keyPointWeights: question.keyPointWeights,
  });

  return {
    questionId: question.id,
    topicId: question.topicId,
    category: question.category,
    topic: question.topic,
    answerText: answer,
    skipped: false,
    score: match.coverageScore,
    matchedPoints: match.matchedPoints,
    missingPoints: match.missingPoints,
  };
}

function average(values: readonly number[]) {
  return values.length === 0
    ? 0
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function buildInterviewReport({
  responses,
  dependencyNodes,
  questions,
  states,
}: {
  responses: readonly InterviewResponse[];
  dependencyNodes: readonly InterviewDependencyNode[];
  questions: readonly InterviewQuestion[];
  states: readonly InterviewQuestionState[];
}): InterviewReport {
  const groupedCategories = new Map<string, InterviewResponse[]>();
  for (const response of responses) {
    const rows = groupedCategories.get(response.category) ?? [];
    rows.push(response);
    groupedCategories.set(response.category, rows);
  }

  const categories = [...groupedCategories]
    .map(([category, rows]) => ({
      category,
      score: average(rows.map((row) => row.score)),
      answered: rows.filter((row) => !row.skipped).length,
      total: rows.length,
    }))
    .sort((left, right) => left.score - right.score || left.category.localeCompare(right.category, "zh-CN"));

  const topicRows: InterviewTopicReport[] = responses.map((response) => ({
    topicId: response.topicId,
    topic: response.topic,
    category: response.category,
    score: response.score,
  }));
  const strongestTopics = [...topicRows]
    .sort((left, right) => right.score - left.score || left.topic.localeCompare(right.topic, "zh-CN"))
    .slice(0, 3);
  const weakestTopics = [...topicRows]
    .sort((left, right) => left.score - right.score || left.topic.localeCompare(right.topic, "zh-CN"))
    .slice(0, 3);

  const missingPoints = [...new Set(
    responses
      .flatMap((response) => response.missingPoints.map((point) => point.point))
      .filter(Boolean),
  )].slice(0, 8);

  const satisfiedTopics = satisfiedKnowledgeTopics(questions, states);
  const dependencyByTopicId = new Map(dependencyNodes.map((node) => [node.topicId, node]));
  const recommendedTopicIds: string[] = [];
  const seenRecommendations = new Set<string>();
  for (const weak of [...topicRows].sort((left, right) => left.score - right.score)) {
    if (weak.score >= 70) continue;
    const node = dependencyByTopicId.get(weak.topicId);
    const missingPrerequisites = (node?.prerequisiteTopicIds ?? [])
      .filter((topicId) => !satisfiedTopics.has(topicId));
    const recommendations = missingPrerequisites.length > 0 ? missingPrerequisites : [weak.topicId];
    for (const topicId of recommendations) {
      if (seenRecommendations.has(topicId)) continue;
      seenRecommendations.add(topicId);
      recommendedTopicIds.push(topicId);
      if (recommendedTopicIds.length >= 4) break;
    }
    if (recommendedTopicIds.length >= 4) break;
  }

  return {
    overallScore: average(responses.map((response) => response.score)),
    answered: responses.filter((response) => !response.skipped).length,
    skipped: responses.filter((response) => response.skipped).length,
    categories,
    strongestTopics,
    weakestTopics,
    missingPoints,
    recommendedTopicIds,
  };
}
