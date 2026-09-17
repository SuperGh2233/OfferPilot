import { describe, expect, it } from "vitest";

import {
  ALGORITHM_DEMO_STORAGE_KEY,
  attachDemoAlgorithmAnalysis,
  cancelDemoAlgorithmAttempt,
  calculateAlgorithmCurrentWeek,
  completeDemoAlgorithmAttempt,
  createAlgorithmDemoData,
  DAILY_RESET_HOUR,
  ensureTodayAlgorithmTasks,
  getAlgorithmDemoDateKey,
  getAlgorithmTrainingDateKey,
  loadAlgorithmDemoData,
  saveAlgorithmDemoData,
  startDemoAlgorithmAttempt,
  type AlgorithmDemoData,
  type StorageLike,
} from "../lib/algorithm/demo-store";
import type { AlgorithmCodeAnalysis } from "../lib/ai/code-analysis";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  setRaw(value: string) {
    this.values.set(ALGORITHM_DEMO_STORAGE_KEY, value);
  }
}

const problems = [
  {
    id: "1",
    tags: ["数组"],
    recommendedWeek: 1,
    importance: 5,
    orderIndex: 1,
  },
  {
    id: "2",
    tags: ["哈希表"],
    recommendedWeek: 1,
    importance: 4,
    orderIndex: 2,
  },
  {
    id: "3",
    tags: ["双指针"],
    recommendedWeek: 1,
    importance: 3,
    orderIndex: 3,
  },
] as const;

const day = (dayNumber: number) => new Date(`2026-09-${String(dayNumber).padStart(2, "0")}T10:00:00+08:00`);
const daysAfterStart = (days: number) =>
  new Date(day(9).getTime() + days * 24 * 60 * 60 * 1000);
const analysis: AlgorithmCodeAnalysis = {
  solutionType: "other",
  complexity: { time: "O(n)", space: "O(1)" },
  summary: "遍历并处理输入。",
  mistakes: [],
  weaknessTags: ["java_api"],
  goodPoints: ["代码结构清晰。"],
  minimalChanges: [],
};

describe("algorithm demo local storage adapter", () => {
  it("falls back safely when storage is missing or malformed", () => {
    const storage = new MemoryStorage();
    const empty = loadAlgorithmDemoData(storage, day(9));
    expect(empty.planStartDate).toBe("2026-09-09");
    expect(empty.states).toEqual({});

    storage.setRaw("{not-json");
    expect(loadAlgorithmDemoData(storage, day(10)).planStartDate).toBe("2026-09-10");

    storage.setRaw(JSON.stringify({ version: 999, planStartDate: "2026-09-09" }));
    expect(loadAlgorithmDemoData(storage, day(11)).planStartDate).toBe("2026-09-11");

    storage.setRaw(JSON.stringify({
      ...createAlgorithmDemoData("2026-09-09"),
      states: { "1": { problemId: "2" } },
    }));
    expect(loadAlgorithmDemoData(storage, day(12)).planStartDate).toBe("2026-09-12");

    const active = startDemoAlgorithmAttempt({
      data: createAlgorithmDemoData("2026-09-09"),
      problemId: "1",
      startedAt: day(9),
      attemptId: "attempt-1",
    }).data;
    active.activeAttempts["1"].mistakeTags = ["not-a-real-tag" as never];
    storage.setRaw(JSON.stringify(active));
    expect(loadAlgorithmDemoData(storage, day(13)).planStartDate).toBe("2026-09-13");
  });

  it("uses Asia/Shanghai date keys and clamps the first cycle to six weeks", () => {
    expect(getAlgorithmDemoDateKey("2026-09-08T15:59:59.000Z")).toBe("2026-09-08");
    expect(getAlgorithmDemoDateKey("2026-09-08T16:00:00.000Z")).toBe("2026-09-09");
    expect(calculateAlgorithmCurrentWeek("2026-09-09", day(9))).toBe(1);
    expect(calculateAlgorithmCurrentWeek("2026-09-09", day(15))).toBe(1);
    expect(calculateAlgorithmCurrentWeek("2026-09-09", day(16))).toBe(2);
    expect(calculateAlgorithmCurrentWeek("2026-09-09", day(23))).toBe(3);
    expect(calculateAlgorithmCurrentWeek("2026-09-09", day(30))).toBe(4);
    expect(calculateAlgorithmCurrentWeek("2026-09-09", daysAfterStart(28))).toBe(5);
    expect(calculateAlgorithmCurrentWeek("2026-09-09", daysAfterStart(35))).toBe(6);
    expect(
      calculateAlgorithmCurrentWeek(
        "2026-09-09",
        daysAfterStart(91),
      ),
    ).toBe(6);
    expect(calculateAlgorithmCurrentWeek("2026-09-09", day(1))).toBe(1);
    expect(getAlgorithmDemoDateKey("2026-09-09T02:00:00.000Z", "America/Los_Angeles"))
      .toBe("2026-09-08");
    expect(getAlgorithmDemoDateKey("2026-09-09", "America/Los_Angeles"))
      .toBe("2026-09-09");
  });

  it("generates and caches the same day's tasks without duplicates", () => {
    const initial = createAlgorithmDemoData("2026-09-09");
    const first = ensureTodayAlgorithmTasks(initial, problems, day(9));
    const second = ensureTodayAlgorithmTasks(first.data, problems, day(9));

    expect(first.tasks).toHaveLength(2);
    expect(first.tasks.every((task) => task.date === "2026-09-09")).toBe(true);
    expect(second.tasks).toEqual(first.tasks);
    expect(second.data).toBe(first.data);
    expect(Object.keys(second.data.dailyTasks)).toEqual(["2026-09-09"]);
  });

  it("uses profile task quotas for a new day", () => {
    const result = ensureTodayAlgorithmTasks(
      createAlgorithmDemoData("2026-09-09"),
      problems,
      day(9),
      { newCount: 1, reviewCount: 0 },
    );
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].taskType).toBe("new");
  });

  it("backfills missed dates with fixed new problems and completes the assigned debt", () => {
    const catalog = Array.from({ length: 8 }, (_, index) => ({
      id: String(index + 1), tags: ["数组"], recommendedWeek: 1,
      importance: 5, orderIndex: index + 1,
    }));
    const first = ensureTodayAlgorithmTasks(createAlgorithmDemoData("2026-09-09"), catalog, day(9));
    const returned = ensureTodayAlgorithmTasks(first.data, catalog, day(11));
    expect(returned.data.dailyTasks["2026-09-09"].map((task) => task.problemId)).toEqual(["1", "2"]);
    expect(returned.data.dailyTasks["2026-09-10"].map((task) => [task.problemId, task.backfilled])).toEqual([["3", true], ["4", true]]);
    expect(returned.tasks.map((task) => task.problemId)).toEqual(["5", "6"]);
    expect(ensureTodayAlgorithmTasks(returned.data, catalog, day(11)).data).toBe(returned.data);

    const started = startDemoAlgorithmAttempt({ data: returned.data, problemId: "3", startedAt: day(11), attemptId: "backfill-3" });
    const completed = completeDemoAlgorithmAttempt({
      data: started.data, problemId: "3", difficulty: "easy", finishedAt: day(11),
      result: "first_ac", independence: "independent", waCount: 0, mistakeTags: [],
    });
    expect(completed.data.dailyTasks["2026-09-10"][0].status).toBe("completed");

    const todayAlreadyAssigned = ensureTodayAlgorithmTasks(createAlgorithmDemoData("2026-09-11"), catalog, day(11)).data;
    const lateBackfill = ensureTodayAlgorithmTasks({ ...todayAlreadyAssigned, planStartDate: "2026-09-09" }, catalog, day(11));
    expect(lateBackfill.tasks.map((task) => task.problemId)).toEqual(["1", "2"]);
    expect(lateBackfill.data.dailyTasks["2026-09-09"].map((task) => task.problemId)).toEqual(["3", "4"]);
  });

  it("starts once and resumes the persisted timer after a reload", () => {
    const storage = new MemoryStorage();
    const initial = createAlgorithmDemoData("2026-09-09");
    const withTasks = ensureTodayAlgorithmTasks(initial, problems, day(9)).data;
    expect(saveAlgorithmDemoData(storage, withTasks)).toBe(true);

    const started = startDemoAlgorithmAttempt({
      data: loadAlgorithmDemoData(storage, day(9)),
      problemId: "1",
      startedAt: day(9),
      attemptId: "attempt-1",
    });
    expect(started.resumed).toBe(false);
    expect(started.attempt.startedAt).toBe(day(9).toISOString());
    expect(started.data.dailyTasks["2026-09-09"][0].status).toBe("in_progress");
    expect(saveAlgorithmDemoData(storage, started.data)).toBe(true);

    const reloaded = loadAlgorithmDemoData(storage, day(9));
    const resumed = startDemoAlgorithmAttempt({
      data: reloaded,
      problemId: "1",
      startedAt: day(9),
      attemptId: "different-id-is-ignored",
    });
    expect(resumed.resumed).toBe(true);
    expect(resumed.attempt.id).toBe("attempt-1");
    expect(resumed.attempt.startedAt).toBe(day(9).toISOString());

    expect(() =>
      startDemoAlgorithmAttempt({
        data: reloaded,
        problemId: "2",
        startedAt: day(9),
        attemptId: "attempt-1",
      }),
    ).toThrow(/unique/);
  });

  it("cancels only the active attempt and restores its in-progress tasks", () => {
    const withTasks = ensureTodayAlgorithmTasks(
      createAlgorithmDemoData("2026-09-09"),
      problems,
      day(9),
    ).data;
    const started = startDemoAlgorithmAttempt({
      data: withTasks,
      problemId: "1",
      startedAt: day(9),
      attemptId: "attempt-to-cancel",
    });
    const canceled = cancelDemoAlgorithmAttempt({
      data: started.data,
      problemId: "1",
      attemptId: started.attempt.id,
    });

    expect(canceled.attempt).toEqual(started.attempt);
    expect(canceled.data.activeAttempts).toEqual({});
    expect(canceled.data.attempts).toEqual([]);
    expect(canceled.data.states).toEqual({});
    expect(canceled.data.dailyTasks["2026-09-09"][0].status).toBe("pending");
    expect(() => cancelDemoAlgorithmAttempt({
      data: canceled.data,
      problemId: "1",
      attemptId: started.attempt.id,
    })).toThrow(/matching active attempt/);
  });

  it("completes a successful attempt, updates mastery and review, then persists a failure", () => {
    const initial = ensureTodayAlgorithmTasks(
      createAlgorithmDemoData("2026-09-09"),
      problems,
      day(9),
    ).data;
    const started = startDemoAlgorithmAttempt({
      data: initial,
      problemId: "1",
      startedAt: day(9),
      attemptId: "attempt-1",
    });
    const successful = completeDemoAlgorithmAttempt({
      data: started.data,
      problemId: "1",
      difficulty: "easy",
      finishedAt: new Date(day(9).getTime() + 20 * 60 * 1000),
      result: "first_ac",
      independence: "independent",
      waCount: 0,
      mistakeTags: [],
      code: "class Solution {}",
    });

    expect(successful.attempt.attemptScore).toBe(88);
    expect(successful.state.mastery).toBe(88);
    expect(successful.state.nextReviewAt).toBe(
      new Date(day(9).getTime() + 20 * 60 * 1000 + 7 * 24 * 60 * 60 * 1000).toISOString(),
    );
    expect(successful.data.attempts).toHaveLength(1);
    expect(successful.data.activeAttempts).toEqual({});
    expect(successful.data.dailyTasks["2026-09-09"][0].status).toBe("completed");

    const secondStart = startDemoAlgorithmAttempt({
      data: successful.data,
      problemId: "1",
      startedAt: day(12),
      attemptId: "attempt-2",
    });
    const failed = completeDemoAlgorithmAttempt({
      data: secondStart.data,
      problemId: "1",
      difficulty: "easy",
      finishedAt: new Date(day(12).getTime() + 45 * 60 * 1000),
      result: "failed",
      independence: "full_solution",
      waCount: 2,
      mistakeTags: ["no_idea"],
    });
    expect(failed.state.mastery).toBe(36.4);
    expect(failed.state.lastResult).toBe("failed");
    expect(failed.data.attempts).toHaveLength(2);
    expect(failed.data.states["1"].nextReviewAt).toBe(
      new Date(day(12).getTime() + 45 * 60 * 1000 + 24 * 60 * 60 * 1000).toISOString(),
    );
  });

  it("completes every outstanding task for a problem without rewriting terminal tasks", () => {
    const withTasks = ensureTodayAlgorithmTasks(
      createAlgorithmDemoData("2026-09-09"),
      problems,
      day(9),
    ).data;
    const currentTask = withTasks.dailyTasks["2026-09-09"][0];
    withTasks.dailyTasks["2026-09-08"] = [{
      ...currentTask,
      date: "2026-09-08",
    }];
    withTasks.dailyTasks["2026-09-07"] = [{
      ...currentTask,
      date: "2026-09-07",
      status: "completed",
      completedAt: "2026-09-07T08:00:00.000Z",
    }];
    const started = startDemoAlgorithmAttempt({
      data: withTasks,
      problemId: currentTask.problemId,
      startedAt: day(9),
      attemptId: "complete-all-outstanding",
    });
    const finishedAt = new Date(day(9).getTime() + 10 * 60 * 1000);
    const completed = completeDemoAlgorithmAttempt({
      data: started.data,
      problemId: currentTask.problemId,
      difficulty: "easy",
      finishedAt,
      result: "first_ac",
      independence: "independent",
      waCount: 0,
      mistakeTags: [],
    });

    expect(completed.data.dailyTasks["2026-09-09"][0]).toMatchObject({
      status: "completed",
      completedAt: finishedAt.toISOString(),
    });
    expect(completed.data.dailyTasks["2026-09-08"][0]).toMatchObject({
      status: "completed",
      completedAt: finishedAt.toISOString(),
    });
    expect(completed.data.dailyTasks["2026-09-07"][0].completedAt)
      .toBe("2026-09-07T08:00:00.000Z");

    const restarted = startDemoAlgorithmAttempt({
      data: completed.data,
      problemId: currentTask.problemId,
      startedAt: day(9),
      attemptId: "restart-completed-task",
    });
    expect(restarted.data.dailyTasks["2026-09-09"][0]).toMatchObject({
      status: "completed",
      completedAt: finishedAt.toISOString(),
    });
  });

  it("attaches AI analysis after completion without changing mastery", () => {
    const started = startDemoAlgorithmAttempt({
      data: createAlgorithmDemoData("2026-09-09"),
      problemId: "1",
      startedAt: day(9),
      attemptId: "attempt-with-code",
    });
    const completed = completeDemoAlgorithmAttempt({
      data: started.data,
      problemId: "1",
      difficulty: "easy",
      finishedAt: new Date(day(9).getTime() + 10 * 60 * 1000),
      result: "first_ac",
      independence: "independent",
      waCount: 0,
      mistakeTags: [],
      code: "class Solution {}",
    });
    const saved = attachDemoAlgorithmAnalysis({
      data: completed.data,
      attemptId: completed.attempt.id,
      problemId: "1",
      aiAnalysis: analysis,
    });

    expect(saved.attempt.aiAnalysis).toEqual(analysis);
    expect(saved.data.states).toEqual(completed.data.states);
    expect(completed.data.attempts[0].aiAnalysis).toBeNull();
    expect(() => attachDemoAlgorithmAnalysis({
      data: completed.data,
      attemptId: "missing",
      problemId: "1",
      aiAnalysis: analysis,
    })).toThrow(/completed attempt with code/);
  });

  it("round-trips valid data through JSON and rejects invalid saves", () => {
    const storage = new MemoryStorage();
    const data: AlgorithmDemoData = createAlgorithmDemoData("2026-09-09");
    expect(saveAlgorithmDemoData(storage, data)).toBe(true);
    expect(loadAlgorithmDemoData(storage, day(20))).toEqual(data);
    expect(
      saveAlgorithmDemoData(storage, {
        ...data,
        version: 2 as never,
      }),
    ).toBe(false);

    const withAttempt = startDemoAlgorithmAttempt({
      data,
      problemId: "1",
      startedAt: day(9),
      attemptId: "attempt-invalid-wa",
    }).data;
    withAttempt.activeAttempts["1"].waCount = 4;
    expect(saveAlgorithmDemoData(storage, withAttempt)).toBe(false);
  });
});

describe("daily task reset at 03:00", () => {
  it("keeps the small hours on the previous training day", () => {
    expect(DAILY_RESET_HOUR).toBe(3);
    expect(getAlgorithmTrainingDateKey("2026-09-17T00:30:00+08:00")).toBe("2026-09-16");
    expect(getAlgorithmTrainingDateKey("2026-09-17T02:59:59+08:00")).toBe("2026-09-16");
    expect(getAlgorithmTrainingDateKey("2026-09-17T03:00:00+08:00")).toBe("2026-09-17");
    expect(getAlgorithmTrainingDateKey("2026-09-17T23:30:00+08:00")).toBe("2026-09-17");
  });

  it("leaves pure date keys unshifted so plan start dates stay correct", () => {
    expect(getAlgorithmTrainingDateKey("2026-09-16")).toBe("2026-09-16");
    expect(getAlgorithmTrainingDateKey("2026-09-16T00:00:00.000Z", "UTC")).toBe("2026-09-15");
    expect(getAlgorithmDemoDateKey("2026-09-16T00:00:00.000Z", "UTC")).toBe("2026-09-16");
  });

  it("generates today's tasks under the previous date before 03:00", () => {
    const initial = createAlgorithmDemoData("2026-09-09");
    const beforeReset = ensureTodayAlgorithmTasks(
      initial,
      problems,
      new Date("2026-09-17T01:30:00+08:00"),
    );
    expect(beforeReset.date).toBe("2026-09-16");
    expect(beforeReset.tasks.every((task) => task.date === "2026-09-16")).toBe(true);

    const afterReset = ensureTodayAlgorithmTasks(
      beforeReset.data,
      problems,
      new Date("2026-09-17T03:30:00+08:00"),
    );
    expect(afterReset.date).toBe("2026-09-17");
    expect(Object.keys(afterReset.data.dailyTasks).sort())
      .toEqual(["2026-09-09", "2026-09-10", "2026-09-16", "2026-09-17"]);
  });

  it("keeps the cycle week aligned with the training day", () => {
    // 计划第 7 天（2026-09-17）的凌晨 1:30 仍属于第 7 天，不应提前翻到第 2 周。
    const initial = createAlgorithmDemoData("2026-09-11");
    const atSmallHours = new Date("2026-09-18T01:30:00+08:00");
    const result = ensureTodayAlgorithmTasks(initial, problems, atSmallHours);

    expect(result.date).toBe("2026-09-17");
    expect(result.currentWeek).toBe(1);
    // 对照：若按真实日历日计算，同一时刻已经会被算成第 2 周。
    expect(calculateAlgorithmCurrentWeek("2026-09-11", atSmallHours)).toBe(2);
  });
});
