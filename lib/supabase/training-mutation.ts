import { getAlgorithmTrainingDateKey } from "../algorithm/demo-store";
import type { AlgorithmAttemptPayload, CompleteAlgorithmAttemptResult } from "../algorithm/attempts";
import type { KnowledgeAttemptPayload, KnowledgeStatePayload } from "../knowledge/attempts";
import type { CloudTrainingSnapshot } from "./training";

/** A saved result, not a second download of the user's complete history. */
export type TrainingMutation =
  | { kind: "algorithm_start"; attempt: AlgorithmAttemptPayload; taskTime: string }
  | { kind: "algorithm_cancel"; attemptId: string; problemId: string }
  | { kind: "algorithm_complete"; completion: CompleteAlgorithmAttemptResult }
  | { kind: "algorithm_analysis"; attempt: AlgorithmAttemptPayload }
  | { kind: "knowledge_record"; result: { attempt: KnowledgeAttemptPayload; state: KnowledgeStatePayload; attemptScore?: number } };

function updateTasks<T extends { status: "pending" | "in_progress" | "completed"; completedAt: string | null }>(
  tasksByDate: Record<string, T[]>,
  matches: (task: T, date: string) => boolean,
  from: readonly T["status"][],
  to: T["status"],
  completedAt: string | null,
): Record<string, T[]> {
  let changed = false;
  const updated: Record<string, T[]> = {};
  for (const [date, tasks] of Object.entries(tasksByDate)) {
    updated[date] = tasks.map((task) => {
      if (!matches(task, date) || !from.includes(task.status)) return task;
      changed = true;
      return { ...task, status: to, completedAt };
    });
  }
  return changed ? updated : tasksByDate;
}

/** Immutable, idempotent merge. Duplicate responses never create duplicate attempts. */
export function applyTrainingMutation(snapshot: CloudTrainingSnapshot, mutation: TrainingMutation): CloudTrainingSnapshot {
  if (mutation.kind === "knowledge_record") {
    const { attempt, state } = mutation.result;
    const knowledge = snapshot.knowledge;
    return {
      ...snapshot,
      knowledge: {
        ...knowledge,
        attempts: knowledge.attempts.some((row) => row.id === attempt.id)
          ? knowledge.attempts.map((row) => row.id === attempt.id ? attempt : row)
          : [...knowledge.attempts, attempt],
        states: { ...knowledge.states, [state.questionId]: state },
        dailyTasks: updateTasks(
          knowledge.dailyTasks,
          (task) => task.questionId === state.questionId,
          ["pending", "in_progress"],
          "completed",
          attempt.createdAt,
        ),
      },
    };
  }

  const algorithm = snapshot.algorithm;
  if (mutation.kind === "algorithm_start") {
    const date = getAlgorithmTrainingDateKey(mutation.taskTime, snapshot.profile.timeZone);
    return {
      ...snapshot,
      algorithm: {
        ...algorithm,
        activeAttempts: { ...algorithm.activeAttempts, [mutation.attempt.problemId]: mutation.attempt },
        dailyTasks: updateTasks(
          algorithm.dailyTasks,
          (task, taskDate) => task.problemId === mutation.attempt.problemId && taskDate === date,
          ["pending"],
          "in_progress",
          null,
        ),
      },
    };
  }
  if (mutation.kind === "algorithm_cancel") {
    const activeAttempts = { ...algorithm.activeAttempts };
    if (activeAttempts[mutation.problemId]?.id === mutation.attemptId) {
      delete activeAttempts[mutation.problemId];
    }
    return {
      ...snapshot,
      algorithm: {
        ...algorithm,
        activeAttempts,
        dailyTasks: updateTasks(
          algorithm.dailyTasks,
          (task) => task.problemId === mutation.problemId,
          ["in_progress"],
          "pending",
          null,
        ),
      },
    };
  }
  if (mutation.kind === "algorithm_complete") {
    const { attempt, state } = mutation.completion;
    const activeAttempts = { ...algorithm.activeAttempts };
    if (activeAttempts[attempt.problemId]?.id === attempt.id) {
      delete activeAttempts[attempt.problemId];
    }
    return {
      ...snapshot,
      algorithm: {
        ...algorithm,
        activeAttempts,
        attempts: algorithm.attempts.some((row) => row.id === attempt.id)
          ? algorithm.attempts.map((row) => row.id === attempt.id ? attempt : row)
          : [...algorithm.attempts, attempt],
        states: { ...algorithm.states, [state.problemId]: state },
        dailyTasks: updateTasks(
          algorithm.dailyTasks,
          (task) => task.problemId === attempt.problemId,
          ["pending", "in_progress"],
          "completed",
          attempt.finishedAt,
        ),
      },
    };
  }
  // AI analysis changes only the saved attempt. Keep newer state/task values.
  return {
    ...snapshot,
    algorithm: {
      ...algorithm,
      attempts: algorithm.attempts.map((row) =>
        row.id === mutation.attempt.id ? mutation.attempt : row,
      ),
    },
  };
}
