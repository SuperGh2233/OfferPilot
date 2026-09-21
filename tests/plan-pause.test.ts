import { describe, expect, it } from "vitest";

import {
  activeTrainingDates,
  activeTrainingDayNumber,
  changePlanPause,
  deferReviewDate,
  isPlanPauseHistory,
  isPlanPaused,
  isPausedTrainingDay,
  pauseDurationDays,
} from "../lib/profile/pause";
import {
  calculateAlgorithmCurrentWeek,
  completeDemoAlgorithmAttempt,
  createAlgorithmDemoData,
  ensureTodayAlgorithmTasks,
  getTrainingDayStart,
  startDemoAlgorithmAttempt,
} from "../lib/algorithm/demo-store";
import {
  createKnowledgeDemoData,
  ensureTodayKnowledgeTasks,
  learnDemoKnowledgeQuestion,
} from "../lib/knowledge/demo-store";
import {
  calculateCyclePosition,
  calculateTrainingBacklog,
  calculateTrainingStreak,
} from "../lib/progress/summary";

const algorithmProblems = Array.from({ length: 20 }, (_, i) => ({
  id: String(i + 1), tags: [], recommendedWeek: 1, importance: 3, orderIndex: i + 1,
}));
const knowledgeQuestions = Array.from({ length: 20 }, (_, i) => ({
  id: `q-${i + 1}`, questionType: "main" as const, isCore6Weeks: true,
  recommendedWeek: 1, importance: 3, sourceOrder: i + 1,
}));

const day = (date: string) => `${date}T12:00:00+08:00`;

describe("plan pause", () => {
  it("starts, persists an open pause, resumes exclusively on the resume day and is idempotent", () => {
    const open = changePlanPause([], true, "2026-09-10");
    expect(isPlanPaused(open)).toBe(true);
    expect(changePlanPause(open, true, "2026-09-11")).toEqual(open);
    expect(isPausedTrainingDay("2026-09-10", open)).toBe(true);
    const resumed = changePlanPause(open, false, "2026-09-13");
    expect(resumed).toEqual([{ start: "2026-09-10", end: "2026-09-13" }]);
    expect(isPausedTrainingDay("2026-09-12", resumed)).toBe(true);
    expect(isPausedTrainingDay("2026-09-13", resumed)).toBe(false);
    expect(changePlanPause(resumed, false, "2026-09-13")).toEqual(resumed);
    expect(pauseDurationDays("2026-09-10", "2026-09-13")).toBe(3);
  });

  it("does not invent a missed day when pause and resume happen on the same day", () => {
    const resumed = changePlanPause(changePlanPause([], true, "2026-09-10"), false, "2026-09-10");
    expect(activeTrainingDates("2026-09-09", "2026-09-12", resumed))
      .toEqual(["2026-09-09", "2026-09-10", "2026-09-11"]);
    expect(pauseDurationDays("2026-09-10", "2026-09-10")).toBe(0);
  });

  it("rejects malformed, backwards and overlapping pause records", () => {
    expect(isPlanPauseHistory([{ start: "bad", end: null }])).toBe(false);
    expect(isPlanPauseHistory([
      { start: "2026-09-10", end: null },
      { start: "2026-09-11", end: null },
    ])).toBe(false);
    expect(() => changePlanPause([{ start: "2026-09-10", end: null }], false, "2026-09-09"))
      .toThrow(/Resume date/);
  });

  it("freezes the paused day but still materializes debt from earlier active days", () => {
    const pauses = [{ start: "2026-09-10", end: null }];
    const algorithm = createAlgorithmDemoData("2026-09-09");
    const knowledge = createKnowledgeDemoData("2026-09-09");
    const algorithmPaused = ensureTodayAlgorithmTasks(algorithm, algorithmProblems, day("2026-09-14"), {
      pausePeriods: pauses,
    });
    const knowledgePaused = ensureTodayKnowledgeTasks(knowledge, knowledgeQuestions, day("2026-09-14"), {
      pausePeriods: pauses,
    });

    expect(algorithmPaused.tasks).toEqual([]);
    expect(knowledgePaused.tasks).toEqual([]);
    expect(algorithmPaused.currentWeek).toBe(1);
    expect(knowledgePaused.currentWeek).toBe(1);
    expect(algorithmPaused.data.dailyTasks["2026-09-09"]).toHaveLength(2);
    expect(knowledgePaused.data.dailyTasks["2026-09-09"]).toHaveLength(3);
    expect(algorithmPaused.data.dailyTasks["2026-09-09"].every((task) => task.backfilled)).toBe(true);
    expect(knowledgePaused.data.dailyTasks["2026-09-09"].every((task) => task.backfilled)).toBe(true);
    expect(algorithmPaused.data.dailyTasks["2026-09-14"]).toBeUndefined();
    expect(knowledgePaused.data.dailyTasks["2026-09-14"]).toBeUndefined();
    expect(calculateCyclePosition("2026-09-09", day("2026-09-14"), "Asia/Shanghai", pauses).day).toBe(2);
    expect(activeTrainingDayNumber("2026-09-09", "2026-09-14", pauses)).toBe(2);
  });

  it("allows historical algorithm and knowledge debt to be completed while the plan stays paused", () => {
    const pauses = [{ start: "2026-09-10", end: null }];
    const algorithmPaused = ensureTodayAlgorithmTasks(
      createAlgorithmDemoData("2026-09-09"), algorithmProblems, day("2026-09-14"), { pausePeriods: pauses },
    );
    const algorithmProblemId = algorithmPaused.data.dailyTasks["2026-09-09"][0].problemId;
    const started = startDemoAlgorithmAttempt({
      data: algorithmPaused.data,
      problemId: algorithmProblemId,
      startedAt: day("2026-09-14"),
      attemptId: "paused-backlog-algorithm",
    });
    const completed = completeDemoAlgorithmAttempt({
      data: started.data,
      problemId: algorithmProblemId,
      difficulty: "easy",
      finishedAt: day("2026-09-14"),
      result: "first_ac",
      independence: "independent",
      waCount: 0,
      mistakeTags: [],
    });
    expect(completed.data.dailyTasks["2026-09-09"][0].status).toBe("completed");
    expect(completed.data.dailyTasks["2026-09-14"]).toBeUndefined();

    const knowledgePaused = ensureTodayKnowledgeTasks(
      createKnowledgeDemoData("2026-09-09"), knowledgeQuestions, day("2026-09-14"), { pausePeriods: pauses },
    );
    const knowledgeQuestionId = knowledgePaused.data.dailyTasks["2026-09-09"][0].questionId;
    const learned = learnDemoKnowledgeQuestion({
      data: knowledgePaused.data,
      questionId: knowledgeQuestionId,
      selfRating: 4,
      attemptedAt: day("2026-09-14"),
      id: "paused-backlog-knowledge",
    });
    expect(learned.data.dailyTasks["2026-09-09"][0].status).toBe("completed");
    expect(learned.data.dailyTasks["2026-09-14"]).toBeUndefined();
  });

  it("resumes without backfilling days off and advances week after seven active days", () => {
    const pauses = [{ start: "2026-09-10", end: "2026-09-13" }];
    expect(activeTrainingDates("2026-09-09", "2026-09-15", pauses))
      .toEqual(["2026-09-09", "2026-09-13", "2026-09-14"]);
    expect(calculateAlgorithmCurrentWeek("2026-09-09", "2026-09-18", "Asia/Shanghai", pauses)).toBe(1);
    expect(calculateAlgorithmCurrentWeek("2026-09-09", "2026-09-19", "Asia/Shanghai", pauses)).toBe(2);
    const result = ensureTodayAlgorithmTasks(createAlgorithmDemoData("2026-09-09"), algorithmProblems,
      day("2026-09-14"), { pausePeriods: pauses });
    expect(Object.keys(result.data.dailyTasks).every((date) => !isPausedTrainingDay(date, pauses))).toBe(true);
    expect(result.date).toBe("2026-09-14");
  });

  it("bridges streaks and excludes paused dates from missed-day and learning-gap counts", () => {
    const pauses = [{ start: "2026-09-10", end: "2026-09-13" }];
    expect(calculateTrainingStreak([
      { date: "2026-09-09", status: "completed" },
      { date: "2026-09-13", status: "completed" },
    ], day("2026-09-13"), "Asia/Shanghai", pauses)).toBe(2);
    const backlog = calculateTrainingBacklog({
      algorithmStates: [], knowledgeStates: [], algorithmDailyTasks: {}, knowledgeDailyTasks: {},
      planStartDate: "2026-09-09", today: day("2026-09-13"), timeZone: "Asia/Shanghai",
      pausePeriods: pauses, dailyNewAlgorithmCount: 1, dailyReviewAlgorithmCount: 0,
      dailyNewKnowledgeCount: 1, dailyReviewKnowledgeCount: 0,
      algorithmLearnedCount: 0, knowledgeLearnedCount: 0,
      algorithmCatalogSize: 100, knowledgeCatalogSize: 120,
    });
    expect(backlog.missedTrainingDays).toBe(1);
    expect(backlog.algorithmLearningGap).toBe(1);
    expect(backlog.knowledgeLearningGap).toBe(1);
  });

  it("keeps pre-pause overdue reviews visible as debt while hiding reviews newly due during the break", () => {
    const pauses = [{ start: "2026-09-10", end: null }];
    const backlog = calculateTrainingBacklog({
      algorithmStates: [
        { attemptCount: 1, nextReviewAt: "2026-09-09T18:00:00.000Z" },
        { attemptCount: 1, nextReviewAt: "2026-09-11T00:00:00.000Z" },
      ],
      knowledgeStates: [
        { attemptCount: 1, nextReviewAt: "2026-09-09T10:00:00.000Z" },
        { attemptCount: 1, nextReviewAt: "2026-09-12T00:00:00.000Z" },
      ],
      algorithmDailyTasks: {}, knowledgeDailyTasks: {},
      planStartDate: "2026-09-09", today: day("2026-09-14"), timeZone: "Asia/Shanghai",
      pausePeriods: pauses, dailyNewAlgorithmCount: 0, dailyReviewAlgorithmCount: 1,
      dailyNewKnowledgeCount: 0, dailyReviewKnowledgeCount: 1,
      algorithmLearnedCount: 0, knowledgeLearnedCount: 0,
      algorithmCatalogSize: 100, knowledgeCatalogSize: 120,
    });
    expect(backlog.algorithmOverdueReviews).toBe(1);
    expect(backlog.knowledgeOverdueReviews).toBe(1);
  });

  it("shifts reviews due during the break, but preserves previously overdue reviews", () => {
    const boundary = getTrainingDayStart("2026-09-10", "Asia/Shanghai");
    expect(boundary).toBe("2026-09-09T19:00:00.000Z");
    expect(deferReviewDate("2026-09-11T00:00:00.000Z", boundary, 3))
      .toBe("2026-09-14T00:00:00.000Z");
    expect(deferReviewDate("2026-09-09T00:00:00.000Z", boundary, 3))
      .toBe("2026-09-09T00:00:00.000Z");
  });

  it("locates 03:00 pause boundaries across Los Angeles DST transitions", () => {
    expect(getTrainingDayStart("2026-03-08", "America/Los_Angeles"))
      .toBe("2026-03-08T10:00:00.000Z");
    expect(getTrainingDayStart("2026-11-01", "America/Los_Angeles"))
      .toBe("2026-11-01T11:00:00.000Z");
  });
});
