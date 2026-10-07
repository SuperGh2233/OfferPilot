import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KnowledgeAbilityMap } from "../components/dashboard/knowledge-ability-map";
import { KnowledgeLearningPath } from "../components/dashboard/knowledge-learning-path";
import {
  knowledgeGraph,
  knowledgeQuestions,
  knowledgeTopicDependencyGraph,
  knowledgeTopics,
} from "../lib/knowledge/catalog";
import { aggregateKnowledgeGraphMastery } from "../lib/knowledge-graph/mastery";
import {
  buildKnowledgeGraph,
  KNOWLEDGE_CATEGORY_ORDER,
} from "../lib/knowledge-graph/model";

describe("Knowledge Graph catalog", () => {
  it("covers all 904 questions with stable category and topic nodes", () => {
    expect(knowledgeQuestions).toHaveLength(904);
    expect(knowledgeTopics).toHaveLength(165);
    expect(knowledgeGraph.categories).toHaveLength(7);
    expect(knowledgeGraph.topics).toHaveLength(165);
    expect(knowledgeGraph.nodes).toHaveLength(172);
    expect(knowledgeGraph.mappings).toHaveLength(904);

    const mappedQuestionIds = new Set(knowledgeGraph.mappings.map((mapping) => mapping.questionId));
    expect(mappedQuestionIds.size).toBe(904);
    expect([...mappedQuestionIds].sort()).toEqual(knowledgeQuestions.map((question) => question.id).sort());

    const nodeIds = new Set(knowledgeGraph.nodes.map((node) => node.id));
    for (const mapping of knowledgeGraph.mappings) {
      expect(mapping.nodeIds).toHaveLength(2);
      expect(nodeIds.has(mapping.categoryNodeId)).toBe(true);
      expect(nodeIds.has(mapping.topicNodeId)).toBe(true);
    }
  });

  it("keeps a deterministic interview-domain order and stable ids", () => {
    expect(knowledgeGraph.categories.map((node) => node.name))
      .toEqual([...KNOWLEDGE_CATEGORY_ORDER]);

    const rebuilt = buildKnowledgeGraph(knowledgeTopics, knowledgeQuestions);
    expect(rebuilt).toEqual(knowledgeGraph);
    expect(rebuilt.categories[0].id).toBe("category:Java基础");
    expect(rebuilt.topics.every((node) => node.id.startsWith("topic:"))).toBe(true);
  });

  it("builds an acyclic prerequisite DAG across all 165 topics", () => {
    expect(knowledgeTopicDependencyGraph.nodes).toHaveLength(165);
    expect(knowledgeTopicDependencyGraph.topologicalTopicIds).toHaveLength(165);
    expect(knowledgeTopicDependencyGraph.edges.length).toBeGreaterThan(100);

    const order = new Map(
      knowledgeTopicDependencyGraph.topologicalTopicIds.map((topicId, index) => [topicId, index]),
    );
    for (const edge of knowledgeTopicDependencyGraph.edges) {
      expect(edge.prerequisiteTopicId).not.toBe(edge.topicId);
      expect(order.get(edge.prerequisiteTopicId)!).toBeLessThan(order.get(edge.topicId)!);
    }

    const topicById = new Map(knowledgeTopics.map((topic) => [topic.id, topic]));
    const node = knowledgeTopicDependencyGraph.nodes.find(
      (item) => item.name === "ConcurrentHashMap" && item.category === "Java并发",
    )!;
    const prerequisiteNames = node.prerequisiteTopicIds.map((topicId) => topicById.get(topicId)!.name);
    expect(prerequisiteNames).toEqual(expect.arrayContaining(["HashMap", "CAS", "synchronized"]));
  });
});

describe("Knowledge Graph mastery", () => {
  const graph = buildKnowledgeGraph(
    [{ id: "hashmap", name: "HashMap", category: "Java集合" }],
    [
      { id: "q-main", topicId: "hashmap", sourceOrder: 1 },
      { id: "q-follow", topicId: "hashmap", sourceOrder: 2 },
    ],
  );
  const questions = [
    { id: "q-main", importance: 4, questionType: "main" as const },
    { id: "q-follow", importance: 2, questionType: "follow_up" as const },
  ];

  it("separates coverage, whole-node mastery and practiced mastery", () => {
    const ability = aggregateKnowledgeGraphMastery({
      graph,
      questions,
      states: [{ questionId: "q-main", mastery: 80, attemptCount: 1 }],
    });
    const category = ability.find((node) => node.kind === "category")!;

    expect(category.totalQuestions).toBe(2);
    expect(category.attemptedQuestions).toBe(1);
    expect(category.coverage).toBe(50);
    expect(category.mastery).toBe(64);
    expect(category.practicedMastery).toBe(80);
  });

  it("represents an unlearned node as zero coverage and zero mastery", () => {
    const [category] = aggregateKnowledgeGraphMastery({
      graph,
      questions,
      states: [],
    }).filter((node) => node.kind === "category");

    expect(category.attemptedQuestions).toBe(0);
    expect(category.coverage).toBe(0);
    expect(category.mastery).toBe(0);
    expect(category.practicedMastery).toBe(0);
  });

  it("renders the Dashboard ability map with weak learned topics", () => {
    const ability = aggregateKnowledgeGraphMastery({
      graph,
      questions,
      states: [{ questionId: "q-main", mastery: 55, attemptCount: 1 }],
    });
    const html = renderToStaticMarkup(
      <KnowledgeAbilityMap
        categories={ability.filter((node) => node.kind === "category")}
        topics={ability.filter((node) => node.kind === "topic")}
      />,
    );

    expect(html).toContain("面试能力地图");
    expect(html).toContain("Java集合");
    expect(html).toContain("HashMap");
    expect(html).toContain("已学习 1/2");
    expect(html).toContain("当前较弱 Topic");
  });

  it("renders ready and blocked prerequisite path explanations", () => {
    const html = renderToStaticMarkup(
      <KnowledgeLearningPath items={[
        {
          topicId: "hashmap",
          name: "HashMap",
          category: "Java集合",
          depth: 3,
          status: "ready",
          missingPrerequisiteNames: [],
        },
        {
          topicId: "chm",
          name: "ConcurrentHashMap",
          category: "Java并发",
          depth: 6,
          status: "blocked",
          missingPrerequisiteNames: ["CAS", "synchronized"],
        },
      ]} />,
    );
    expect(html).toContain("当前学习路径");
    expect(html).toContain("HashMap");
    expect(html).toContain("ConcurrentHashMap");
    expect(html).toContain("CAS、synchronized");
  });
});
