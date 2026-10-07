export const KNOWLEDGE_PREREQUISITE_MASTERY = 45;

export type KnowledgeReadinessQuestion = {
  id: string;
  topicId?: string;
  questionType: "main" | "follow_up";
  isCore6Weeks: boolean;
};

export type KnowledgeReadinessState = {
  questionId: string;
  mastery: number;
  attemptCount: number;
};

export function satisfiedKnowledgeTopics(
  questions: readonly KnowledgeReadinessQuestion[],
  states: readonly KnowledgeReadinessState[],
) {
  const stateById = new Map(states.map((state) => [state.questionId, state]));
  const topics = new Map<string, KnowledgeReadinessQuestion[]>();
  for (const question of questions) {
    if (!question.topicId) continue;
    const rows = topics.get(question.topicId) ?? [];
    rows.push(question);
    topics.set(question.topicId, rows);
  }

  const satisfied = new Set<string>();
  for (const [topicId, rows] of topics) {
    const schedulable = rows.filter((question) => question.isCore6Weeks && question.questionType === "main");
    // A graph-only prerequisite with no core main question must not deadlock the six-week planner.
    if (schedulable.length === 0) {
      satisfied.add(topicId);
      continue;
    }
    if (schedulable.some((question) => {
      const state = stateById.get(question.id);
      return Boolean(
        state
        && state.attemptCount > 0
        && state.mastery >= KNOWLEDGE_PREREQUISITE_MASTERY,
      );
    })) {
      satisfied.add(topicId);
    }
  }
  return satisfied;
}

export function knowledgePrerequisitesSatisfied(
  prerequisiteTopicIds: readonly string[] | undefined,
  satisfiedTopics: ReadonlySet<string>,
) {
  return (prerequisiteTopicIds ?? []).every((topicId) => satisfiedTopics.has(topicId));
}

export type KnowledgeTopicPathStatus = {
  topicId: string;
  status: "learned" | "ready" | "blocked";
  missingPrerequisiteTopicIds: readonly string[];
};

export function evaluateKnowledgeTopicPath({
  topicIds,
  prerequisiteTopicIdsByTopic,
  questions,
  states,
}: {
  topicIds: readonly string[];
  prerequisiteTopicIdsByTopic: ReadonlyMap<string, readonly string[]>;
  questions: readonly KnowledgeReadinessQuestion[];
  states: readonly KnowledgeReadinessState[];
}): KnowledgeTopicPathStatus[] {
  const satisfiedTopics = satisfiedKnowledgeTopics(questions, states);
  return topicIds.map((topicId) => {
    if (satisfiedTopics.has(topicId)) {
      return { topicId, status: "learned" as const, missingPrerequisiteTopicIds: [] };
    }
    const missingPrerequisiteTopicIds = (prerequisiteTopicIdsByTopic.get(topicId) ?? [])
      .filter((prerequisiteId) => !satisfiedTopics.has(prerequisiteId));
    return {
      topicId,
      status: missingPrerequisiteTopicIds.length === 0 ? "ready" as const : "blocked" as const,
      missingPrerequisiteTopicIds,
    };
  });
}
