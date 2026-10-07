import { describe, expect, it } from "vitest";

import {
  recordKnowledgeLearn,
  recordKnowledgeRecall,
  type KnowledgeAttemptPayload,
  type KnowledgeStatePayload,
} from "../lib/knowledge/attempts";
import {
  knowledgeQuestions,
  knowledgeTopicDependencyGraph,
  toKnowledgePlannerQuestion,
} from "../lib/knowledge/catalog";
import {
  knowledgePrerequisitesSatisfied,
  satisfiedKnowledgeTopics,
} from "../lib/knowledge-graph/readiness";
import { calculateKnowledgeTopicMastery } from "../lib/mastery/knowledge";
import {
  generateDailyKnowledgeTasks,
  type KnowledgePlannerQuestion,
} from "../lib/planner/knowledge";

const start = new Date("2026-09-01T08:00:00.000Z");
const atDay = (day: number) => new Date(start.getTime() + (day - 1) * 24 * 60 * 60 * 1000);

const questions: KnowledgePlannerQuestion[] = Array.from({ length: 7 }, (_, index) => ({
  id: `q${index + 1}`,
  questionType: "main",
  isCore6Weeks: true,
  recommendedWeek: 1,
  importance: 5,
  sourceOrder: index + 1,
}));

describe("knowledge seven-day cycle", () => {
  it("learns, recalls, re-enters due work and changes topic mastery deterministically", () => {
    const states: Record<string, KnowledgeStatePayload> = {};
    const attempts: KnowledgeAttemptPayload[] = [];
    const dailyTaskIds: string[][] = [];
    let masteryAfterDayOne = 0;

    for (let day = 1; day <= 7; day += 1) {
      const today = atDay(day);
      const tasks = generateDailyKnowledgeTasks({
        questions,
        states: Object.values(states),
        currentWeek: 1,
        newCount: 1,
        reviewCount: 2,
        today,
      });
      dailyTaskIds.push(tasks.map(({ questionId }) => questionId));

      expect(generateDailyKnowledgeTasks({
        questions,
        states: Object.values(states),
        existingTasks: tasks,
        currentWeek: 1,
        newCount: 1,
        reviewCount: 2,
        today,
      })).toEqual([]);

      for (const task of tasks) {
        if (task.taskType === "new") {
          const learned = recordKnowledgeLearn({
            id: `day-${day}-${task.questionId}`,
            userId: "local-user",
            questionId: task.questionId,
            attemptedAt: today,
            selfRating: task.questionId === "q1" ? 1 : 4,
          });
          attempts.push(learned.attempt);
          states[task.questionId] = learned.state;
          continue;
        }

        const recalled = recordKnowledgeRecall({
          id: `day-${day}-${task.questionId}`,
          userId: "local-user",
          questionId: task.questionId,
          attemptedAt: today,
          answerText: day === 2 && task.questionId === "q1" ? "" : "核心结论",
          keyPoints: ["核心结论"],
          previousState: states[task.questionId],
        });
        attempts.push(recalled.attempt);
        states[task.questionId] = recalled.state;
      }

      const topicMastery = calculateKnowledgeTopicMastery(
        questions.map((question) => ({
          mastery: states[question.id]?.mastery ?? null,
          importance: question.importance,
          questionType: question.questionType,
        })),
      );
      if (day === 1) masteryAfterDayOne = topicMastery;
      if (day === 7) expect(topicMastery).toBeGreaterThan(masteryAfterDayOne);
    }

    expect(dailyTaskIds[0]).toEqual(["q1"]);
    expect(dailyTaskIds[1]).toEqual(["q1", "q2"]);
    expect(dailyTaskIds[2]).toEqual(["q1", "q3"]);
    expect(dailyTaskIds[5]).toEqual(["q3", "q1", "q6"]);
    expect(states.q1).toMatchObject({ mastery: 74.76, recallCount: 3, status: "learning" });
    expect(states.q2).toMatchObject({ mastery: 73, recallCount: 1 });
    expect(attempts.some(({ coverageScore }) => coverageScore === 0)).toBe(true);
    expect(attempts.some(({ coverageScore }) => coverageScore === 100)).toBe(true);
  });

  it("respects real-catalog prerequisite gates while continuing learn and review work over seven days", () => {
    const plannerQuestions = knowledgeQuestions.map(toKnowledgePlannerQuestion);
    const catalogById = new Map(knowledgeQuestions.map((question) => [question.id, question]));
    const dependencyByTopicId = new Map(
      knowledgeTopicDependencyGraph.nodes.map((node) => [node.topicId, node]),
    );
    const states: Record<string, KnowledgeStatePayload> = {};
    const learnedTopicIds = new Set<string>();
    let reviewTaskCount = 0;
    let nonRootLearnCount = 0;

    for (let day = 1; day <= 7; day += 1) {
      const today = atDay(day);
      const satisfiedBefore = satisfiedKnowledgeTopics(
        plannerQuestions,
        Object.values(states),
      );
      const tasks = generateDailyKnowledgeTasks({
        questions: plannerQuestions,
        states: Object.values(states),
        currentWeek: 4,
        newCount: 5,
        reviewCount: 5,
        today,
      });

      expect(generateDailyKnowledgeTasks({
        questions: plannerQuestions,
        states: Object.values(states),
        existingTasks: tasks,
        currentWeek: 4,
        newCount: 5,
        reviewCount: 5,
        today,
      })).toEqual([]);

      for (const task of tasks) {
        const plannerQuestion = plannerQuestions.find(({ id }) => id === task.questionId)!;
        const question = catalogById.get(task.questionId)!;

        if (task.taskType === "new") {
          expect(
            knowledgePrerequisitesSatisfied(
              plannerQuestion.prerequisiteTopicIds,
              satisfiedBefore,
            ),
            `new task ${question.topic}/${question.question} must have satisfied prerequisites`,
          ).toBe(true);
          learnedTopicIds.add(question.topicId);
          if ((dependencyByTopicId.get(question.topicId)?.depth ?? 0) > 0) {
            nonRootLearnCount += 1;
          }
          states[question.id] = recordKnowledgeLearn({
            id: `real-day-${day}-${question.id}`,
            userId: "local-user",
            questionId: question.id,
            attemptedAt: today,
            selfRating: 4,
          }).state;
          continue;
        }

        reviewTaskCount += 1;
        states[question.id] = recordKnowledgeRecall({
          id: `real-day-${day}-${question.id}`,
          userId: "local-user",
          questionId: question.id,
          attemptedAt: today,
          answerText: question.keyPoints.join(" "),
          keyPoints: question.keyPoints,
          keywordAliases: question.keywordAliases,
          keyPointWeights: question.keyPointWeights,
          previousState: states[question.id],
        }).state;
      }
    }

    expect(learnedTopicIds.size).toBeGreaterThan(5);
    expect(nonRootLearnCount).toBeGreaterThan(0);
    expect(reviewTaskCount).toBeGreaterThan(0);
    expect(Object.values(states).filter((state) => state.attemptCount > 0).length)
      .toBeGreaterThan(5);
  });
});
