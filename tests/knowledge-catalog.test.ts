import { describe, expect, it } from "vitest";

import {
  getKnowledgeFollowUps,
  getKnowledgeQuestion,
  knowledgeQuestions,
  knowledgeTopics,
} from "../lib/knowledge/catalog";

describe("knowledge catalog", () => {
  it("maps the complete source and 120 core main questions", () => {
    expect(knowledgeTopics).toHaveLength(165);
    expect(knowledgeQuestions).toHaveLength(904);
    expect(knowledgeQuestions.filter(({ questionType }) => questionType === "main")).toHaveLength(394);
    expect(knowledgeQuestions.filter(({ questionType }) => questionType === "follow_up")).toHaveLength(510);

    const core = knowledgeQuestions.filter(({ isCore6Weeks }) => isCore6Weeks);
    expect(core).toHaveLength(120);
    expect(core.every(({ questionType }) => questionType === "main")).toBe(true);
  });

  it("uses the documented 20/5 key point weights for every question", () => {
    for (const question of knowledgeQuestions) {
      expect(Object.keys(question.keyPointWeights)).toHaveLength(question.keyPoints.length);
      question.keyPoints.forEach((_, index) => {
        expect(question.keyPointWeights[String(index)]).toBe(index === 0 ? 20 : 5);
      });
    }
  });

  it("maps categories to the confirmed four teaching weeks", () => {
    expect(knowledgeTopics.find(({ category }) => category === "Java基础")?.recommendedWeek).toBe(1);
    expect(knowledgeTopics.find(({ category }) => category === "Java并发")?.recommendedWeek).toBe(2);
    expect(knowledgeTopics.find(({ category }) => category === "JVM")?.recommendedWeek).toBe(3);
    expect(knowledgeTopics.find(({ category }) => category === "MySQL")?.recommendedWeek).toBe(4);
  });

  it("resolves a question and its follow-ups from stable ids", () => {
    const parent = knowledgeQuestions.find((question) =>
      question.questionType === "main" && getKnowledgeFollowUps(question.id).length > 0,
    );
    expect(parent).toBeDefined();
    expect(getKnowledgeQuestion(parent!.id)).toBe(parent);
    expect(getKnowledgeFollowUps(parent!.id).every(({ parentId }) => parentId === parent!.id)).toBe(true);
  });
});
