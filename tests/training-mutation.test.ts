import { describe, expect, it } from "vitest";

import { createAlgorithmDemoData } from "../lib/algorithm/demo-store";
import type { AlgorithmAttemptPayload, AlgorithmStatePayload } from "../lib/algorithm/attempts";
import { createKnowledgeDemoData } from "../lib/knowledge/demo-store";
import type { KnowledgeAttemptPayload, KnowledgeStatePayload } from "../lib/knowledge/attempts";
import { createDemoProfile } from "../lib/profile/demo-store";
import type { CloudTrainingSnapshot } from "../lib/supabase/training";
import { applyTrainingMutation } from "../lib/supabase/training-mutation";

const startedAt = "2026-09-20T04:00:00.000Z";
const finishedAt = "2026-09-20T04:20:00.000Z";
const attempt: AlgorithmAttemptPayload = {
  id: "attempt-1", userId: "user-1", problemId: "1", startedAt,
  finishedAt: null, durationSeconds: null, result: null, independence: null,
  waCount: 0, mistakeTags: [], code: null, aiAnalysis: null,
  attemptScore: null, masteryBefore: null, masteryAfter: null,
};
const state: AlgorithmStatePayload = {
  userId: "user-1", problemId: "1", mastery: 70, attemptCount: 1,
  lastAttemptAt: finishedAt, nextReviewAt: "2026-09-23T04:20:00.000Z",
  status: "learning", lastResult: "first_ac", independentAcCount: 1,
  lastIndependentAcAt: finishedAt, spacedIndependentAcAt: null,
};
const completed: AlgorithmAttemptPayload = {
  ...attempt, finishedAt, durationSeconds: 1200, result: "first_ac",
  independence: "independent", attemptScore: 70, masteryAfter: 70,
};

function snapshot(): CloudTrainingSnapshot {
  const algorithm = createAlgorithmDemoData("2026-09-19");
  const knowledge = createKnowledgeDemoData("2026-09-19");
  algorithm.dailyTasks["2026-09-19"] = [
    { problemId: "1", date: "2026-09-19", taskType: "new", reason: "week_1_new", sortOrder: 0, status: "pending", completedAt: null },
  ];
  algorithm.dailyTasks["2026-09-20"] = [
    { problemId: "1", date: "2026-09-20", taskType: "review", reason: "review_due", sortOrder: 0, status: "pending", completedAt: null },
    { problemId: "2", date: "2026-09-20", taskType: "new", reason: "week_1_new", sortOrder: 1, status: "pending", completedAt: null },
  ];
  knowledge.dailyTasks["2026-09-20"] = [
    { questionId: "q1", date: "2026-09-20", taskType: "new", reason: "week_1_new", sortOrder: 0, status: "pending", completedAt: null },
  ];
  return { algorithm, knowledge, profile: createDemoProfile("2026-09-19") };
}

const knowledgeState: KnowledgeStatePayload = {
  userId: "user-1", questionId: "q1", mastery: 45, attemptCount: 1,
  lastAttemptAt: finishedAt, nextReviewAt: "2026-09-21T04:20:00.000Z",
  status: "learning", learnCount: 1, recallCount: 0,
  lastRecallAt: null, lastRecallCoverageScore: null,
};
const knowledgeAttempt: KnowledgeAttemptPayload = {
  id: "knowledge-1", userId: "user-1", questionId: "q1", mode: "learn",
  selfRating: 2, answerText: null, coverageScore: null, effectiveCoverageScore: null,
  aiAnalysis: null, matchedPoints: [], missingPoints: [], masteryBefore: null,
  masteryAfter: 45, createdAt: finishedAt,
};

describe("incremental training mutations", () => {
  it("starts only today's pending task and cancels without deleting history", () => {
    const original = snapshot();
    const started = applyTrainingMutation(original, {
      kind: "algorithm_start", attempt, taskTime: startedAt,
    });
    expect(original.algorithm.activeAttempts).toEqual({});
    expect(original.algorithm.dailyTasks["2026-09-20"][0].status).toBe("pending");
    expect(started.algorithm.activeAttempts["1"]).toEqual(attempt);
    expect(started.algorithm.dailyTasks["2026-09-20"].map((task) => task.status))
      .toEqual(["in_progress", "pending"]);
    expect(started.algorithm.dailyTasks["2026-09-19"][0].status).toBe("pending");

    const canceled = applyTrainingMutation(started, {
      kind: "algorithm_cancel", attemptId: attempt.id, problemId: "1",
    });
    expect(canceled.algorithm.activeAttempts["1"]).toBeUndefined();
    expect(canceled.algorithm.dailyTasks["2026-09-20"][0].status).toBe("pending");
    expect(canceled.algorithm.attempts).toEqual([]);
  });

  it("completes all pending tasks, updates mastery, and is idempotent on replay", () => {
    const initial = applyTrainingMutation(snapshot(), {
      kind: "algorithm_start", attempt, taskTime: startedAt,
    });
    const mutation = { kind: "algorithm_complete" as const, completion: { attempt: completed, state } };
    const once = applyTrainingMutation(initial, mutation);
    const twice = applyTrainingMutation(once, mutation);
    expect(twice.algorithm.activeAttempts["1"]).toBeUndefined();
    expect(twice.algorithm.attempts).toEqual([completed]);
    expect(twice.algorithm.states["1"]).toEqual(state);
    expect(twice.algorithm.dailyTasks["2026-09-19"][0]).toMatchObject({ status: "completed", completedAt: finishedAt });
    expect(twice.algorithm.dailyTasks["2026-09-20"].map((task) => task.status))
      .toEqual(["completed", "pending"]);
    expect(initial.algorithm.dailyTasks["2026-09-19"][0].status).toBe("pending");
  });

  it("updates AI analysis in the saved attempt without overwriting state", () => {
    const once = applyTrainingMutation(snapshot(), {
      kind: "algorithm_complete", completion: { attempt: completed, state },
    });
    const updated = { ...completed, code: "class Solution {}" };
    const next = applyTrainingMutation(once, { kind: "algorithm_analysis", attempt: updated });
    expect(next.algorithm.attempts).toEqual([updated]);
    expect(next.algorithm.states["1"]).toEqual(state);
    expect(next.algorithm.dailyTasks).toEqual(once.algorithm.dailyTasks);
  });

  it("saves one knowledge attempt and completes the corresponding task once", () => {
    const mutation = {
      kind: "knowledge_record" as const,
      result: { attempt: knowledgeAttempt, state: knowledgeState },
    };
    const once = applyTrainingMutation(snapshot(), mutation);
    const twice = applyTrainingMutation(once, mutation);
    expect(twice.knowledge.attempts).toEqual([knowledgeAttempt]);
    expect(twice.knowledge.states.q1).toEqual(knowledgeState);
    expect(twice.knowledge.dailyTasks["2026-09-20"][0]).toMatchObject({
      status: "completed", completedAt: finishedAt,
    });
    expect(twice.algorithm.attempts).toEqual([]);
  });
});
