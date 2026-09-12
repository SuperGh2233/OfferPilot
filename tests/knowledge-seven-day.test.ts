import { describe, expect, it } from "vitest";

import {
  recordKnowledgeLearn,
  recordKnowledgeRecall,
  type KnowledgeAttemptPayload,
  type KnowledgeStatePayload,
} from "../lib/knowledge/attempts";
import {
  knowledgeQuestions,
  knowledgeTopics,
  toKnowledgePlannerQuestion,
} from "../lib/knowledge/catalog";
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

  it("raises mastery for the five target topics with the real catalog over seven days", () => {
    const topicNames = ["HashMap", "线程池", "JVM", "MySQL", "Redis"] as const;
    const selectedQuestions = topicNames.map((topicName) => {
      const topic = knowledgeTopics.find(({ name }) => name === topicName);
      expect(topic, `${topicName} topic`).toBeDefined();
      const question = knowledgeQuestions.find((candidate) =>
        candidate.topicId === topic!.id
        && candidate.questionType === "main"
        && candidate.isCore6Weeks,
      );
      expect(question, `${topicName} core question`).toBeDefined();
      return question!;
    });
    const plannerQuestions = selectedQuestions.map(toKnowledgePlannerQuestion);
    const states: Record<string, KnowledgeStatePayload> = {};
    const masteryAfterLearn = new Map<string, number>();
    const taskIdsByDay: string[][] = [];

    for (let day = 1; day <= 7; day += 1) {
      const today = atDay(day);
      const tasks = generateDailyKnowledgeTasks({
        questions: plannerQuestions,
        states: Object.values(states),
        currentWeek: 4,
        newCount: 5,
        reviewCount: 5,
        today,
      });
      taskIdsByDay.push(tasks.map(({ questionId }) => questionId));

      for (const task of tasks) {
        const question = selectedQuestions.find(({ id }) => id === task.questionId)!;
        if (task.taskType === "new") {
          states[question.id] = recordKnowledgeLearn({
            id: `real-day-${day}-${question.id}`,
            userId: "local-user",
            questionId: question.id,
            attemptedAt: today,
            selfRating: 4,
          }).state;
        } else {
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

      if (day === 1) {
        for (const topicName of topicNames) {
          const topic = knowledgeTopics.find(({ name }) => name === topicName)!;
          masteryAfterLearn.set(topicName, calculateKnowledgeTopicMastery(
            knowledgeQuestions
              .filter(({ topicId }) => topicId === topic.id)
              .map((question) => ({
                mastery: states[question.id]?.mastery ?? null,
                importance: question.importance,
                questionType: question.questionType,
              })),
          ));
        }
      }
    }

    expect(new Set(taskIdsByDay[0])).toEqual(new Set(selectedQuestions.map(({ id }) => id)));
    expect(taskIdsByDay[1]).toEqual([]);
    expect(taskIdsByDay[2]).toEqual([]);
    expect(new Set(taskIdsByDay[3])).toEqual(new Set(selectedQuestions.map(({ id }) => id)));
    expect(taskIdsByDay.slice(4)).toEqual([[], [], []]);

    for (const topicName of topicNames) {
      const topic = knowledgeTopics.find(({ name }) => name === topicName)!;
      const finalMastery = calculateKnowledgeTopicMastery(
        knowledgeQuestions
          .filter(({ topicId }) => topicId === topic.id)
          .map((question) => ({
            mastery: states[question.id]?.mastery ?? null,
            importance: question.importance,
            questionType: question.questionType,
          })),
      );
      expect(finalMastery, topicName).toBeGreaterThan(masteryAfterLearn.get(topicName)!);
    }
  });
});
