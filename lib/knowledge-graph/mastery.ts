import type { KnowledgeGraph, KnowledgeGraphNode } from "./model";

export type KnowledgeGraphQuestionMasteryInput = {
  id: string;
  importance: number;
  questionType: "main" | "follow_up";
};

export type KnowledgeGraphStateInput = {
  questionId: string;
  mastery: number;
  attemptCount: number;
};

export type KnowledgeAbilityNode = {
  id: string;
  kind: KnowledgeGraphNode["kind"];
  name: string;
  category: string;
  parentId: string | null;
  order: number;
  totalQuestions: number;
  attemptedQuestions: number;
  coverage: number;
  mastery: number;
  practicedMastery: number;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function questionWeight(question: KnowledgeGraphQuestionMasteryInput) {
  if (!Number.isFinite(question.importance) || question.importance <= 0) {
    throw new RangeError(`knowledge question ${question.id} importance must be greater than 0`);
  }
  if (question.questionType !== "main" && question.questionType !== "follow_up") {
    throw new RangeError(`knowledge question ${question.id} questionType is invalid`);
  }
  return question.importance * (question.questionType === "main" ? 1 : 0.5);
}

export function aggregateKnowledgeGraphMastery({
  graph,
  questions,
  states,
}: {
  graph: KnowledgeGraph;
  questions: readonly KnowledgeGraphQuestionMasteryInput[];
  states: readonly KnowledgeGraphStateInput[];
}): KnowledgeAbilityNode[] {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const stateById = new Map(states.map((state) => [state.questionId, state]));

  return graph.nodes.map((node) => {
    let totalWeight = 0;
    let weightedMastery = 0;
    let attemptedWeight = 0;
    let attemptedWeightedMastery = 0;
    let attemptedQuestions = 0;

    for (const questionId of node.questionIds) {
      const question = questionById.get(questionId);
      if (!question) throw new RangeError(`knowledge graph references unknown question ${questionId}`);
      const weight = questionWeight(question);
      totalWeight += weight;

      const state = stateById.get(questionId);
      if (!state || state.attemptCount <= 0) continue;
      if (!Number.isFinite(state.mastery) || state.mastery < 0 || state.mastery > 100) {
        throw new RangeError(`knowledge state ${questionId} mastery must be between 0 and 100`);
      }
      attemptedQuestions += 1;
      attemptedWeight += weight;
      weightedMastery += state.mastery * weight;
      attemptedWeightedMastery += state.mastery * weight;
    }

    const totalQuestions = node.questionIds.length;
    return {
      id: node.id,
      kind: node.kind,
      name: node.name,
      category: node.category,
      parentId: node.parentId,
      order: node.order,
      totalQuestions,
      attemptedQuestions,
      coverage: totalQuestions === 0 ? 0 : round(attemptedQuestions / totalQuestions * 100),
      mastery: totalWeight === 0 ? 0 : round(weightedMastery / totalWeight),
      practicedMastery: attemptedWeight === 0 ? 0 : round(attemptedWeightedMastery / attemptedWeight),
    };
  });
}
