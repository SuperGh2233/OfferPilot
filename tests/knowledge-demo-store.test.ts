import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_DEMO_STORAGE_KEY,
  createKnowledgeDemoData,
  ensureTodayKnowledgeTasks,
  learnDemoKnowledgeQuestion,
  loadKnowledgeDemoData,
  recallDemoKnowledgeQuestion,
  saveKnowledgeDemoData,
} from "../lib/knowledge/demo-store";
import type { StorageLike } from "../lib/algorithm/demo-store";

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const questions = Array.from({ length: 4 }, (_, index) => ({
  id: `q${index + 1}`,
  questionType: "main" as const,
  isCore6Weeks: true,
  recommendedWeek: 1,
  importance: 5,
  sourceOrder: index + 1,
}));
const day = (number: number) => new Date(`2026-09-${String(number).padStart(2, "0")}T08:00:00.000Z`);

describe("knowledge demo store", () => {
  it("recovers from missing and malformed storage", () => {
    const storage = new MemoryStorage();
    expect(loadKnowledgeDemoData(storage, day(1)).planStartDate).toBe("2026-09-01");
    storage.setItem(KNOWLEDGE_DEMO_STORAGE_KEY, "{bad-json");
    expect(loadKnowledgeDemoData(storage, day(2)).planStartDate).toBe("2026-09-02");
    storage.setItem(KNOWLEDGE_DEMO_STORAGE_KEY, JSON.stringify({
      ...createKnowledgeDemoData(day(1)),
      planStartDate: "2026-99-99",
    }));
    expect(loadKnowledgeDemoData(storage, day(3)).planStartDate).toBe("2026-09-03");
  });

  it("keeps a date-only plan start unchanged in negative UTC offsets", () => {
    expect(
      createKnowledgeDemoData("2026-09-09", "America/Los_Angeles")
        .planStartDate,
    ).toBe("2026-09-09");
  });

  it("generates and caches today's tasks", () => {
    const initial = createKnowledgeDemoData(day(1));
    const first = ensureTodayKnowledgeTasks(initial, questions, day(1));
    const second = ensureTodayKnowledgeTasks(first.data, questions, day(1));
    expect(first.tasks).toHaveLength(3);
    expect(second.tasks).toEqual(first.tasks);
    expect(second.data).toBe(first.data);
  });

  it("uses profile task quotas for a new day", () => {
    const result = ensureTodayKnowledgeTasks(
      createKnowledgeDemoData(day(1)),
      questions,
      day(1),
      { newCount: 2, reviewCount: 0 },
    );
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks.every((task) => task.taskType === "new")).toBe(true);
  });

  it("persists Learn then Recall and completes the matching daily task", () => {
    const storage = new MemoryStorage();
    const withTasks = ensureTodayKnowledgeTasks(
      createKnowledgeDemoData(day(1)),
      questions,
      day(1),
    ).data;
    const learned = learnDemoKnowledgeQuestion({
      data: withTasks,
      questionId: "q1",
      selfRating: 4,
      attemptedAt: day(1),
      id: "learn-1",
    });
    expect(learned.state.mastery).toBe(55);
    expect(learned.data.dailyTasks["2026-09-01"][0].status).toBe("completed");

    const recalled = recallDemoKnowledgeQuestion({
      data: learned.data,
      questionId: "q1",
      answerText: "resize",
      keyPoints: ["扩容", "阈值"],
      keywordAliases: { 扩容: ["resize"] },
      attemptedAt: day(4),
      id: "recall-1",
    });
    expect(recalled.attempt.coverageScore).toBe(80);
    expect(recalled.state.mastery).toBe(73);
    expect(recalled.data.attempts).toHaveLength(2);
    expect(saveKnowledgeDemoData(storage, recalled.data)).toBe(true);
    expect(loadKnowledgeDemoData(storage, day(4))).toEqual(recalled.data);
  });

  it("completes every pending task for a question without rewriting completed history", () => {
    const withTasks = ensureTodayKnowledgeTasks(
      createKnowledgeDemoData(day(1)),
      questions,
      day(1),
    ).data;
    const currentTask = withTasks.dailyTasks["2026-09-01"][0];
    withTasks.dailyTasks["2026-08-31"] = [{
      ...currentTask,
      date: "2026-08-31",
      status: "in_progress",
    }];
    withTasks.dailyTasks["2026-08-30"] = [{
      ...currentTask,
      date: "2026-08-30",
      status: "completed",
      completedAt: "2026-08-30T08:00:00.000Z",
    }];

    const learned = learnDemoKnowledgeQuestion({
      data: withTasks,
      questionId: currentTask.questionId,
      selfRating: 4,
      attemptedAt: day(1),
      id: "complete-all-pending",
    });

    expect(learned.data.dailyTasks["2026-09-01"][0].status).toBe("completed");
    expect(learned.data.dailyTasks["2026-08-31"][0].status).toBe("completed");
    expect(learned.data.dailyTasks["2026-08-30"][0].completedAt)
      .toBe("2026-08-30T08:00:00.000Z");
  });
});

describe("daily task reset at 03:00", () => {
  it("aligns knowledge tasks with the same reset boundary as algorithm tasks", () => {
    const initial = createKnowledgeDemoData("2026-09-09");
    const beforeReset = ensureTodayKnowledgeTasks(
      initial,
      questions,
      new Date("2026-09-17T01:30:00+08:00"),
    );
    expect(beforeReset.date).toBe("2026-09-16");

    const afterReset = ensureTodayKnowledgeTasks(
      beforeReset.data,
      questions,
      new Date("2026-09-17T03:30:00+08:00"),
    );
    expect(afterReset.date).toBe("2026-09-17");
  });
});
