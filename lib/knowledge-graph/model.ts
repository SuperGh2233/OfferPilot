export type KnowledgeGraphNodeKind = "category" | "topic";

export type KnowledgeGraphNode = {
  id: string;
  kind: KnowledgeGraphNodeKind;
  name: string;
  category: string;
  parentId: string | null;
  order: number;
  questionIds: readonly string[];
};

export type QuestionKnowledgeMapping = {
  questionId: string;
  categoryNodeId: string;
  topicNodeId: string;
  nodeIds: readonly [string, string];
};

export type KnowledgeGraph = {
  nodes: readonly KnowledgeGraphNode[];
  categories: readonly KnowledgeGraphNode[];
  topics: readonly KnowledgeGraphNode[];
  mappings: readonly QuestionKnowledgeMapping[];
};

export type KnowledgeGraphTopicInput = {
  id: string;
  name: string;
  category: string;
};

export type KnowledgeGraphQuestionInput = {
  id: string;
  topicId: string;
  sourceOrder: number;
};

export const KNOWLEDGE_CATEGORY_ORDER = [
  "Java基础",
  "Java集合",
  "Java并发",
  "JVM",
  "Spring",
  "MySQL",
  "Redis",
] as const;

function categoryNodeId(category: string) {
  return `category:${category}`;
}

function topicNodeId(topicId: string) {
  return `topic:${topicId}`;
}

function categoryRank(category: string) {
  const index = KNOWLEDGE_CATEGORY_ORDER.indexOf(category as (typeof KNOWLEDGE_CATEGORY_ORDER)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function buildKnowledgeGraph(
  topics: readonly KnowledgeGraphTopicInput[],
  questions: readonly KnowledgeGraphQuestionInput[],
): KnowledgeGraph {
  const topicById = new Map<string, KnowledgeGraphTopicInput>();
  for (const topic of topics) {
    if (!topic.id.trim() || !topic.name.trim() || !topic.category.trim()) {
      throw new RangeError("knowledge topics require non-empty id, name and category");
    }
    if (topicById.has(topic.id)) throw new RangeError(`duplicate knowledge topic id: ${topic.id}`);
    topicById.set(topic.id, topic);
  }

  const topicQuestionIds = new Map<string, string[]>();
  const topicOrder = new Map<string, number>();
  const seenQuestionIds = new Set<string>();
  for (const question of questions) {
    if (!question.id.trim()) throw new RangeError("knowledge question id must be non-empty");
    if (seenQuestionIds.has(question.id)) throw new RangeError(`duplicate knowledge question id: ${question.id}`);
    seenQuestionIds.add(question.id);
    if (!Number.isSafeInteger(question.sourceOrder) || question.sourceOrder < 0) {
      throw new RangeError(`knowledge question ${question.id} sourceOrder must be a non-negative integer`);
    }
    if (!topicById.has(question.topicId)) {
      throw new RangeError(`knowledge question ${question.id} references unknown topic ${question.topicId}`);
    }
    const ids = topicQuestionIds.get(question.topicId) ?? [];
    ids.push(question.id);
    topicQuestionIds.set(question.topicId, ids);
    topicOrder.set(question.topicId, Math.min(topicOrder.get(question.topicId) ?? Number.MAX_SAFE_INTEGER, question.sourceOrder));
  }

  const categories = [...new Set(topics.map((topic) => topic.category))]
    .sort((left, right) => categoryRank(left) - categoryRank(right) || left.localeCompare(right, "zh-CN"))
    .map((category, order) => {
      const categoryTopicIds = topics.filter((topic) => topic.category === category).map((topic) => topic.id);
      const questionIds = categoryTopicIds.flatMap((id) => topicQuestionIds.get(id) ?? []);
      return {
        id: categoryNodeId(category),
        kind: "category" as const,
        name: category,
        category,
        parentId: null,
        order,
        questionIds,
      };
    });

  const categoryOrder = new Map(categories.map((node) => [node.category, node.order]));
  const topicNodes = topics
    .map((topic) => ({
      id: topicNodeId(topic.id),
      kind: "topic" as const,
      name: topic.name,
      category: topic.category,
      parentId: categoryNodeId(topic.category),
      order: topicOrder.get(topic.id) ?? Number.MAX_SAFE_INTEGER,
      questionIds: topicQuestionIds.get(topic.id) ?? [],
    }))
    .sort((left, right) =>
      (categoryOrder.get(left.category) ?? Number.MAX_SAFE_INTEGER)
        - (categoryOrder.get(right.category) ?? Number.MAX_SAFE_INTEGER)
      || left.order - right.order
      || left.name.localeCompare(right.name, "zh-CN"),
    )
    .map((node, index) => ({ ...node, order: index }));

  const topicNodeBySourceId = new Map(
    topics.map((topic) => [topic.id, topicNodeId(topic.id)]),
  );
  const mappings = questions.map((question) => {
    const topic = topicById.get(question.topicId)!;
    const categoryId = categoryNodeId(topic.category);
    const topicId = topicNodeBySourceId.get(question.topicId)!;
    return {
      questionId: question.id,
      categoryNodeId: categoryId,
      topicNodeId: topicId,
      nodeIds: [categoryId, topicId] as const,
    };
  });

  return {
    nodes: [...categories, ...topicNodes],
    categories,
    topics: topicNodes,
    mappings,
  };
}
