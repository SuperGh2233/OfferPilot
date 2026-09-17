import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  algorithmAttemptFromRow,
  algorithmStateFromRow,
  cancelCloudAlgorithmAttempt,
  CloudTrainingConflictError,
  knowledgeAttemptFromRow,
  knowledgeStateFromRow,
  importCloudAlgorithms,
  loadCloudTrainingSnapshot,
  profileFromRow,
  saveCloudAlgorithmAnalysis,
  updateCloudProfile,
} from "../lib/supabase/training";
import { algorithmCatalog } from "../lib/algorithm/catalog";
import type { DemoProfile } from "../lib/profile/demo-store";
import type {
  AlgorithmAttempt,
  Profile,
  UserAlgorithmState,
  UserKnowledgeState,
} from "../types/database";

const profile: Profile = {
  id: "user-1",
  display_name: "秋招选手",
  timezone: "Asia/Shanghai",
  plan_start_date: "2026-09-09",
  daily_new_algorithm_count: 2,
  daily_review_algorithm_count: 1,
  daily_new_knowledge_count: 3,
  daily_review_knowledge_count: 3,
  created_at: "2026-09-09T00:00:00.000Z",
  updated_at: "2026-09-09T00:00:00.000Z",
};

type FakeResult = { data: unknown; error: null };

class FakeSupabase {
  readonly insertedTasks: unknown[] = [];
  readonly ranges: Record<string, [number, number][]> = {};

  constructor(private readonly rows: Record<string, unknown[]>) {}

  from(table: string) {
    const filters: [string, unknown][] = [];
    let bounds: [number, number] | null = null;
    const result = (): FakeResult => {
      let data = [...(this.rows[table] ?? [])];
      for (const [column, value] of filters) {
        data = data.filter((row) => (row as Record<string, unknown>)[column] === value);
      }
      if (bounds) data = data.slice(bounds[0], bounds[1] + 1);
      return { data, error: null };
    };
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return query;
      },
      order: () => query,
      range: (from: number, to: number) => {
        bounds = [from, to];
        (this.ranges[table] ??= []).push([from, to]);
        return query;
      },
      maybeSingle: async () => {
        const rows = result().data as unknown[];
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        const rows = result().data as unknown[];
        return { data: rows[0] ?? null, error: null };
      },
      insert: async (rows: unknown | unknown[]) => {
        const values = Array.isArray(rows) ? rows : [rows];
        if (table === "daily_tasks") {
          this.insertedTasks.push(...values);
          const storedTasks = (this.rows.daily_tasks ??= []);
          for (const value of values) {
            storedTasks.push({
              id: `task-${storedTasks.length + 1}`,
              algorithm_problem_id: null,
              knowledge_question_id: null,
              completed_at: null,
              metadata: {},
              created_at: "2026-09-11T08:00:00.000Z",
              updated_at: "2026-09-11T08:00:00.000Z",
              ...(value as Record<string, unknown>),
            });
          }
        }
        return { data: null, error: null };
      },
      then: (
        resolve: (value: FakeResult) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  }
}

function cloudRows(algorithmAttempts: AlgorithmAttempt[] = []) {
  return {
    profiles: [profile],
    algorithm_problems: algorithmCatalog.map((problem) => ({
      id: `db-${problem.id}`,
      leetcode_id: problem.leetcodeId,
    })),
    algorithm_attempts: algorithmAttempts,
    user_algorithm_state: [],
    knowledge_attempts: [],
    user_knowledge_state: [],
    daily_tasks: [],
  };
}

describe("Supabase training adapter", () => {
  it("maps profile rows to the shared UI profile and rejects unsupported timezones", () => {
    expect(profileFromRow(profile)).toMatchObject({
      displayName: "秋招选手",
      timeZone: "Asia/Shanghai",
      planStartDate: "2026-09-09",
      dailyNewAlgorithmCount: 2,
      dailyReviewKnowledgeCount: 3,
    });
    expect(() => profileFromRow({ ...profile, timezone: "Mars/Olympus" }))
      .toThrow(/Unsupported profile timezone/);
  });

  it("rejects malformed profile request shapes before touching Supabase", async () => {
    await expect(
      updateCloudProfile(
        {} as never,
        "user-1",
        { version: 1 } as DemoProfile,
      ),
    ).rejects.toThrow(/Profile fields are invalid/);
  });

  it("maps a Supabase P0002 mutation error to a retryable conflict", async () => {
    const client = {
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { code: "P0002", message: "Open attempt not found" },
              }),
            }),
          }),
        }),
      }),
    };
    await expect(
      updateCloudProfile(client as never, "user-1", profileFromRow(profile)),
    ).rejects.toBeInstanceOf(CloudTrainingConflictError);
  });

  it("imports only missing algorithm states and schedules a conservative review", async () => {
    let importedRows: Record<string, unknown>[] = [];
    const completedTaskProblemIds: unknown[][] = [];
    const client = {
      from: (table: string) => {
        if (table === "algorithm_problems") {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  { id: "db-1", leetcode_id: 1 },
                  { id: "db-49", leetcode_id: 49 },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "user_algorithm_state") {
          return {
            select: () => ({
              eq: () => ({
                in: async () => ({
                  data: [{ problem_id: "db-1" }],
                  error: null,
                }),
              }),
            }),
            upsert: async (rows: Record<string, unknown>[]) => {
              importedRows = rows;
              return { data: null, error: null };
            },
          };
        }
        const query = {
          eq: () => query,
          in: (_column: string, values: unknown[]) => {
            completedTaskProblemIds.push(values);
            return query;
          },
          then: (
            resolve: (value: FakeResult) => unknown,
            reject?: (reason: unknown) => unknown,
          ) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
        };
        return { update: () => query };
      },
    };

    await expect(importCloudAlgorithms(
      client as never,
      "user-1",
      ["1", "49"],
      new Date("2026-09-13T04:00:00.000Z"),
    )).resolves.toEqual({ importedCount: 1, skippedCount: 1 });
    expect(importedRows).toEqual([expect.objectContaining({
      user_id: "user-1",
      problem_id: "db-49",
      mastery: 60,
      attempt_count: 1,
      next_review_at: "2026-09-16T04:00:00.000Z",
      status: "learning",
    })]);
    expect(completedTaskProblemIds).toContainEqual(["db-49"]);
  });

  it("paginates long histories and persists missed-day assignments once", async () => {
    const attempts: AlgorithmAttempt[] = Array.from({ length: 1_001 }, (_, index) => ({
      id: `attempt-${index}`,
      user_id: "user-1",
      problem_id: `db-${algorithmCatalog[0].id}`,
      started_at: `2026-09-09T01:00:00.${String(index).padStart(3, "0")}Z`,
      finished_at: "2026-09-09T01:20:00.000Z",
      duration_seconds: 1_200,
      result: "first_ac",
      independence: "independent",
      wa_count: 0,
      mistake_tags: [],
      code: null,
      ai_analysis: null,
      attempt_score: 88,
      mastery_before: null,
      mastery_after: 88,
      created_at: "2026-09-09T01:00:00.000Z",
      updated_at: "2026-09-09T01:20:00.000Z",
    }));
    const fake = new FakeSupabase(cloudRows(attempts));

    const snapshot = await loadCloudTrainingSnapshot(
      fake as never,
      "user-1",
      new Date("2026-09-11T08:00:00.000Z"),
    );

    expect(snapshot.algorithm.attempts).toHaveLength(1_001);
    expect(fake.ranges.algorithm_attempts).toEqual([[0, 999], [1_000, 1_999]]);
    expect(fake.insertedTasks).toHaveLength(15);
    expect(fake.insertedTasks.filter((row) =>
      (row as Record<string, unknown>).algorithm_problem_id,
    )).toHaveLength(6);
    expect(fake.insertedTasks.filter((row) =>
      (row as Record<string, unknown>).knowledge_question_id,
    )).toHaveLength(9);
    expect(fake.insertedTasks[0]).toMatchObject({
      user_id: "user-1",
      task_date: "2026-09-09",
      status: "pending",
      metadata: { source: "backfill" },
    });
    expect(fake.insertedTasks.filter((row) => (row as Record<string, unknown>).task_date === "2026-09-11")).toHaveLength(5);

    const repeated = await loadCloudTrainingSnapshot(
      fake as never,
      "user-1",
      new Date("2026-09-11T08:00:00.000Z"),
    );
    expect(fake.insertedTasks).toHaveLength(15);
    expect(repeated.algorithm.dailyTasks["2026-09-09"][0].backfilled).toBe(true);
    expect(repeated.algorithm.dailyTasks["2026-09-11"]).toHaveLength(2);
    expect(repeated.knowledge.dailyTasks["2026-09-11"]).toHaveLength(3);
  });

  it("rejects a 100-row cloud catalog when an expected LeetCode id is missing", async () => {
    const rows = cloudRows();
    rows.algorithm_problems = rows.algorithm_problems.map((row, index) =>
      index === 0 ? { ...row, leetcode_id: 999_999 } : row,
    );
    const fake = new FakeSupabase(rows);

    await expect(loadCloudTrainingSnapshot(
      fake as never,
      "user-1",
      new Date("2026-09-11T08:00:00.000Z"),
    )).rejects.toThrow(/catalog is incomplete/);
    expect(fake.insertedTasks).toEqual([]);
  });

  it("maps algorithm UUID rows back to the LeetCode route id", () => {
    const attempt: AlgorithmAttempt = {
      id: "attempt-1",
      user_id: "user-1",
      problem_id: "database-problem-uuid",
      started_at: "2026-09-09T01:00:00.000Z",
      finished_at: "2026-09-09T01:20:00.000Z",
      duration_seconds: 1200,
      result: "first_ac",
      independence: "independent",
      wa_count: 0,
      mistake_tags: ["boundary"],
      code: null,
      ai_analysis: null,
      attempt_score: 88,
      mastery_before: null,
      mastery_after: 88,
      created_at: "2026-09-09T01:00:00.000Z",
      updated_at: "2026-09-09T01:20:00.000Z",
    };
    expect(algorithmAttemptFromRow(attempt, "1")).toMatchObject({
      problemId: "1",
      result: "first_ac",
      mistakeTags: ["boundary"],
      masteryAfter: 88,
    });

    const state: UserAlgorithmState = {
      user_id: "user-1",
      problem_id: "database-problem-uuid",
      mastery: 88,
      attempt_count: 1,
      last_attempt_at: "2026-09-09T01:20:00.000Z",
      next_review_at: "2026-09-16T01:20:00.000Z",
      status: "learning",
      last_result: "first_ac",
      independent_ac_count: 1,
      last_independent_ac_at: "2026-09-09T01:20:00.000Z",
      spaced_independent_ac_at: null,
      created_at: "2026-09-09T01:20:00.000Z",
      updated_at: "2026-09-09T01:20:00.000Z",
    };
    expect(algorithmStateFromRow(state, "1")).toMatchObject({
      problemId: "1",
      mastery: 88,
      lastResult: "first_ac",
    });
    expect(() => algorithmStateFromRow({ ...state, next_review_at: null }, "1"))
      .toThrow(/next_review_at/);
  });

  it("persists post-completion AI analysis on the matching attempt", async () => {
    const aiAnalysis = {
      solutionType: "other" as const,
      complexity: { time: "O(n)", space: "O(1)" },
      summary: "遍历并处理输入。",
      mistakes: [],
      weaknessTags: ["java_api" as const],
      goodPoints: ["代码结构清晰。"],
      minimalChanges: [],
    };
    const attempt: AlgorithmAttempt = {
      id: "attempt-1",
      user_id: "user-1",
      problem_id: "db-1",
      started_at: "2026-09-09T01:00:00.000Z",
      finished_at: "2026-09-09T01:20:00.000Z",
      duration_seconds: 1200,
      result: "first_ac",
      independence: "independent",
      wa_count: 0,
      mistake_tags: [],
      code: "class Solution {}",
      ai_analysis: null,
      attempt_score: 88,
      mastery_before: null,
      mastery_after: 88,
      created_at: "2026-09-09T01:00:00.000Z",
      updated_at: "2026-09-09T01:20:00.000Z",
    };
    let updatePayload: unknown;
    const mutation = {
      eq: () => mutation,
      not: () => mutation,
      select: () => mutation,
      single: async () => ({
        data: { ...attempt, ai_analysis: updatePayload },
        error: null,
      }),
    };
    const client = {
      from: (table: string) => table === "algorithm_problems"
        ? {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: "db-1", leetcode_id: 1 },
                  error: null,
                }),
              }),
            }),
          }
        : {
            update: (value: unknown) => {
              updatePayload = (value as { ai_analysis: unknown }).ai_analysis;
              return mutation;
            },
          },
    };

    const saved = await saveCloudAlgorithmAnalysis(client as never, "user-1", {
      attemptId: attempt.id,
      problemId: "1",
      aiAnalysis,
    });

    expect(updatePayload).toEqual(aiAnalysis);
    expect(saved.aiAnalysis).toEqual(aiAnalysis);
    expect(saved.attemptScore).toBe(88);
  });

  it("deletes only the matching open attempt and restores in-progress tasks", async () => {
    const filters: Array<[string, unknown]> = [];
    let restoredTasks: unknown;
    const deletion = {
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return deletion;
      },
      is: (column: string, value: unknown) => {
        filters.push([column, value]);
        return deletion;
      },
      select: () => deletion,
      maybeSingle: async () => ({ data: { id: "attempt-1" }, error: null }),
    };
    const taskUpdate = {
      eq: () => taskUpdate,
      then: (
        resolve: (value: { data: null; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
    };
    const client = {
      from: (table: string) => {
        if (table === "algorithm_problems") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: "db-1", leetcode_id: 1 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "algorithm_attempts") {
          return { delete: () => deletion };
        }
        return {
          update: (value: unknown) => {
            restoredTasks = value;
            return taskUpdate;
          },
        };
      },
    };

    await expect(cancelCloudAlgorithmAttempt(client as never, "user-1", {
      attemptId: "attempt-1",
      problemId: "1",
    })).resolves.toBeUndefined();
    expect(filters).toEqual([
      ["id", "attempt-1"],
      ["user_id", "user-1"],
      ["problem_id", "db-1"],
      ["finished_at", null],
    ]);
    expect(restoredTasks).toEqual({ status: "pending", completed_at: null });
  });

  it("maps knowledge evidence and keeps structured matched points", () => {
    const attempt = knowledgeAttemptFromRow({
      id: "attempt-2",
      user_id: "user-1",
      question_id: "question-1",
      mode: "recall",
      self_rating: null,
      answer_text: "哈希定位",
      coverage_score: 80,
      effective_coverage_score: null,
      ai_analysis: null,
      matched_points: [{ index: 0, point: "哈希", weight: 20, matchedBy: "哈希" }],
      missing_points: [],
      mastery_before: 55,
      mastery_after: 73,
      created_at: "2026-09-10T01:00:00.000Z",
      updated_at: "2026-09-10T01:00:00.000Z",
    });
    expect(attempt.matchedPoints[0]).toEqual({
      index: 0,
      point: "哈希",
      weight: 20,
      matchedBy: "哈希",
    });
    // 旧记录没有 effective_coverage_score，读取时必须回退为确定性覆盖率。
    expect(attempt.effectiveCoverageScore).toBe(80);
    expect(attempt.aiAnalysis).toBeNull();

    const state: UserKnowledgeState = {
      user_id: "user-1",
      question_id: "question-1",
      mastery: 73,
      attempt_count: 2,
      last_attempt_at: "2026-09-10T01:00:00.000Z",
      next_review_at: "2026-09-15T01:00:00.000Z",
      status: "learning",
      learn_count: 1,
      recall_count: 1,
      last_recall_at: "2026-09-10T01:00:00.000Z",
      last_recall_coverage_score: 80,
      created_at: "2026-09-09T01:00:00.000Z",
      updated_at: "2026-09-10T01:00:00.000Z",
    };
    expect(knowledgeStateFromRow(state)).toMatchObject({
      questionId: "question-1",
      attemptCount: 2,
      recallCount: 1,
    });
  });

  it("keeps start, complete, and knowledge writes inside authenticated SQL transactions", async () => {
    const sql = await readFile(
      resolve(
        process.cwd(),
        "supabase/migrations/202609090001_training_rpcs.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("start_algorithm_training_attempt");
    expect(sql).toContain("complete_algorithm_training_attempt");
    expect(sql).toContain("record_knowledge_training_attempt");
    expect(sql.match(/security invoker/g)).toHaveLength(3);
    expect(sql.match(/auth\.uid\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("and finished_at is null");
    expect(sql.match(/status in \('pending', 'in_progress'\)/g)).toHaveLength(2);
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("p_expected_attempt_count");
    expect(sql).toContain("grant execute on function");
  });

  it("keeps every table behind RLS and public catalogs authenticated-only", async () => {
    const sql = await readFile(
      resolve(
        process.cwd(),
        "supabase/migrations/202609080001_initial_schema.sql",
      ),
      "utf8",
    );
    const ownedTables = [
      "profiles",
      "algorithm_attempts",
      "user_algorithm_state",
      "knowledge_attempts",
      "user_knowledge_state",
      "daily_tasks",
    ];
    const catalogTables = [
      "algorithm_problems",
      "knowledge_topics",
      "knowledge_questions",
    ];
    for (const table of [...ownedTables, ...catalogTables]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    for (const table of ownedTables) {
      expect(sql).toContain(`create policy ${table}_own_rows`);
    }
    for (const table of catalogTables) {
      expect(sql).toContain(`create policy ${table}_authenticated_read`);
    }
    expect(sql).not.toMatch(/\bto\s+anon\b/i);
  });
});
