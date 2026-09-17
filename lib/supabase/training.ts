import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isAlgorithmCodeAnalysis,
  type AlgorithmCodeAnalysis,
} from "../ai/code-analysis";
import {
  parseKnowledgeRecallAnalysis,
  type KnowledgeRecallAnalysis,
} from "../ai/knowledge-recall-analysis";
import {
  completeAlgorithmAttempt,
  type AlgorithmAttemptPayload,
  type AlgorithmStatePayload,
  type CompleteAlgorithmAttemptResult,
} from "../algorithm/attempts";
import {
  algorithmCatalog,
  getAlgorithmProblem,
  toAlgorithmPlannerProblem,
} from "../algorithm/catalog";
import { IMPORTED_ALGORITHM_MASTERY } from "../algorithm/import-progress";
import {
  createAlgorithmDemoData,
  ensureTodayAlgorithmTasks,
  getAlgorithmDemoDateKey,
  getAlgorithmTrainingDateKey,
  type AlgorithmDemoData,
  type LocalAlgorithmTask,
} from "../algorithm/demo-store";
import {
  recordKnowledgeLearn,
  recordKnowledgeRecall,
  type KnowledgeAttemptPayload,
  type KnowledgeStatePayload,
} from "../knowledge/attempts";
import {
  getKnowledgeQuestion,
  knowledgeQuestions,
  toKnowledgePlannerQuestion,
} from "../knowledge/catalog";
import {
  createKnowledgeDemoData,
  ensureTodayKnowledgeTasks,
  type KnowledgeDemoData,
  type LocalKnowledgeTask,
} from "../knowledge/demo-store";
import type {
  KnowledgeMatchedPoint,
  KnowledgeMissingPoint,
} from "../knowledge/match";
import type {
  AlgorithmIndependence,
  AlgorithmMistakeTag,
  AlgorithmResult,
} from "../mastery/algorithm";
import { calculateNextAlgorithmReview } from "../mastery/algorithm";
import type { KnowledgeSelfRating } from "../mastery/knowledge";
import {
  createDemoProfile,
  DEMO_TIME_ZONES,
  type DemoProfile,
  type DemoTimeZone,
} from "../profile/demo-store";
import type {
  AlgorithmAttempt,
  AlgorithmProblem,
  DailyTask,
  Database,
  Json,
  KnowledgeAttempt,
  Profile,
  UserAlgorithmState,
  UserKnowledgeState,
} from "../../types/database";

type Client = SupabaseClient<Database>;
type DailyTaskInsert = Database["public"]["Tables"]["daily_tasks"]["Insert"];
type UserAlgorithmStateInsert = Database["public"]["Tables"]["user_algorithm_state"]["Insert"];
type PageResult<T> = {
  data: T[] | null;
  error: { code?: string; message: string } | null;
};

const PAGE_SIZE = 1_000;

export class CloudTrainingConflictError extends Error {}

export type CloudTrainingSnapshot = {
  algorithm: AlgorithmDemoData;
  knowledge: KnowledgeDemoData;
  profile: DemoProfile;
};

export type CompleteCloudAlgorithmInput = {
  attemptId: string;
  problemId: string;
  finishedAt: string;
  result: AlgorithmResult;
  independence: AlgorithmIndependence;
  waCount: number;
  mistakeTags: readonly AlgorithmMistakeTag[];
  code?: string | null;
  aiAnalysis?: AlgorithmCodeAnalysis | null;
};

export type SaveCloudAlgorithmAnalysisInput = {
  attemptId: string;
  problemId: string;
  aiAnalysis: AlgorithmCodeAnalysis;
};

export type CancelCloudAlgorithmInput = {
  attemptId: string;
  problemId: string;
};

export type RecordCloudKnowledgeInput =
  | {
      attemptId: string;
      mode: "learn";
      questionId: string;
      attemptedAt: string;
      selfRating: KnowledgeSelfRating;
    }
  | {
      attemptId: string;
      mode: "recall";
      questionId: string;
      attemptedAt: string;
      answerText: string;
      /** AI 语义复核结果；缺失时本次按确定性覆盖率计分。 */
      aiAnalysis?: KnowledgeRecallAnalysis | null;
    };

function fail(
  label: string,
  error: { code?: string; message: string } | null,
) {
  if (!error) return;
  if (
    error.code === "40001" ||
    error.code === "23505" ||
    error.code === "P0002"
  ) {
    throw new CloudTrainingConflictError(label + ": " + error.message);
  }
  throw new Error(label + ": " + error.message);
}

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error("Supabase data is missing " + label);
  }
  return value;
}

async function loadAllPages<T>(
  label: string,
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await loadPage(from, from + PAGE_SIZE - 1);
    fail(label, result.error);
    const page = required(result.data, label);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function stringArray(value: Json): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? [...value]
    : [];
}

function typedArray<T>(value: Json): T[] {
  return Array.isArray(value) ? (value as unknown as T[]) : [];
}

function algorithmTaskReason(value: string): LocalAlgorithmTask["reason"] {
  if (
    value === "review_due" ||
    value === "weakness_related" ||
    /^week_[1-6]_new$/.test(value)
  ) {
    return value as LocalAlgorithmTask["reason"];
  }
  throw new Error("Invalid algorithm task reason: " + value);
}

function knowledgeTaskReason(value: string): LocalKnowledgeTask["reason"] {
  if (value === "review_due" || /^week_\d+_new$/.test(value)) {
    return value as LocalKnowledgeTask["reason"];
  }
  throw new Error("Invalid knowledge task reason: " + value);
}

function parseAiAnalysis(value: Json | null): AlgorithmCodeAnalysis | null {
  return isAlgorithmCodeAnalysis(value) ? value : null;
}

/**
 * 读取落库的 AI 语义复核结果。
 *
 * 这里拿不到题目上下文，因此把 keyPointCount 放宽到上限，让校验退化为纯结构校验；
 * 损坏的记录按"没有 AI 复核"处理，不让单条脏数据阻断整个训练快照。
 */
function parseKnowledgeAiAnalysis(value: Json | null): KnowledgeRecallAnalysis | null {
  if (value === null) return null;
  try {
    return parseKnowledgeRecallAnalysis(value, Number.MAX_SAFE_INTEGER);
  } catch {
    return null;
  }
}

export function profileFromRow(row: Profile): DemoProfile {
  const timeZone = DEMO_TIME_ZONES.find((value) => value === row.timezone);
  if (!timeZone) throw new Error("Unsupported profile timezone: " + row.timezone);
  return {
    version: 1,
    displayName: row.display_name ?? "",
    timeZone,
    planStartDate: row.plan_start_date,
    dailyNewAlgorithmCount: row.daily_new_algorithm_count,
    dailyReviewAlgorithmCount: row.daily_review_algorithm_count,
    dailyNewKnowledgeCount: row.daily_new_knowledge_count,
    dailyReviewKnowledgeCount: row.daily_review_knowledge_count,
  };
}

export function algorithmAttemptFromRow(
  row: AlgorithmAttempt,
  problemId: string,
): AlgorithmAttemptPayload {
  return {
    id: row.id,
    userId: row.user_id,
    problemId,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSeconds: row.duration_seconds,
    result: row.result,
    independence: row.independence,
    waCount: row.wa_count,
    mistakeTags: stringArray(row.mistake_tags) as AlgorithmMistakeTag[],
    code: row.code,
    aiAnalysis: parseAiAnalysis(row.ai_analysis),
    attemptScore: row.attempt_score,
    masteryBefore: row.mastery_before,
    masteryAfter: row.mastery_after,
  };
}

export function algorithmStateFromRow(
  row: UserAlgorithmState,
  problemId: string,
): AlgorithmStatePayload {
  return {
    userId: row.user_id,
    problemId,
    mastery: row.mastery,
    attemptCount: row.attempt_count,
    lastAttemptAt: row.last_attempt_at,
    nextReviewAt: required(row.next_review_at, "algorithm next_review_at"),
    status: row.status,
    lastResult: required(row.last_result, "algorithm last_result"),
    independentAcCount: row.independent_ac_count,
    lastIndependentAcAt: row.last_independent_ac_at,
    spacedIndependentAcAt: row.spaced_independent_ac_at,
  };
}

export function knowledgeAttemptFromRow(
  row: KnowledgeAttempt,
): KnowledgeAttemptPayload {
  return {
    id: row.id,
    userId: row.user_id,
    questionId: row.question_id,
    mode: row.mode,
    selfRating: row.self_rating as KnowledgeSelfRating | null,
    answerText: row.answer_text,
    coverageScore: row.coverage_score,
    effectiveCoverageScore: row.effective_coverage_score ?? row.coverage_score,
    aiAnalysis: parseKnowledgeAiAnalysis(row.ai_analysis),
    matchedPoints: typedArray<KnowledgeMatchedPoint>(row.matched_points),
    missingPoints: typedArray<KnowledgeMissingPoint>(row.missing_points),
    masteryBefore: row.mastery_before,
    masteryAfter: required(row.mastery_after, "knowledge mastery_after"),
    createdAt: row.created_at,
  };
}

export function knowledgeStateFromRow(
  row: UserKnowledgeState,
): KnowledgeStatePayload {
  return {
    userId: row.user_id,
    questionId: row.question_id,
    mastery: row.mastery,
    attemptCount: row.attempt_count,
    lastAttemptAt: required(row.last_attempt_at, "knowledge last_attempt_at"),
    nextReviewAt: required(row.next_review_at, "knowledge next_review_at"),
    status: row.status,
    learnCount: row.learn_count,
    recallCount: row.recall_count,
    lastRecallAt: row.last_recall_at,
    lastRecallCoverageScore: row.last_recall_coverage_score,
  };
}

function algorithmTasks(
  rows: readonly DailyTask[],
  problemIds: ReadonlyMap<string, string>,
): Record<string, LocalAlgorithmTask[]> {
  const grouped: Record<string, LocalAlgorithmTask[]> = {};
  for (const row of rows) {
    if (!row.algorithm_problem_id || row.status === "skipped") continue;
    const problemId = problemIds.get(row.algorithm_problem_id);
    if (!problemId) continue;
    (grouped[row.task_date] ??= []).push({
      problemId,
      taskType: row.task_type,
      reason: algorithmTaskReason(row.reason),
      sortOrder: row.sort_order,
      date: row.task_date,
      status: row.status,
      completedAt: row.completed_at,
      backfilled: row.metadata !== null && typeof row.metadata === "object" && !Array.isArray(row.metadata) && row.metadata.source === "backfill",
    });
  }
  return grouped;
}

function knowledgeTasks(
  rows: readonly DailyTask[],
): Record<string, LocalKnowledgeTask[]> {
  const grouped: Record<string, LocalKnowledgeTask[]> = {};
  for (const row of rows) {
    if (
      !row.knowledge_question_id ||
      row.status === "skipped" ||
      row.task_type === "weakness"
    ) continue;
    (grouped[row.task_date] ??= []).push({
      questionId: row.knowledge_question_id,
      taskType: row.task_type,
      reason: knowledgeTaskReason(row.reason),
      sortOrder: row.sort_order,
      date: row.task_date,
      status: row.status,
      completedAt: row.completed_at,
      backfilled: row.metadata !== null && typeof row.metadata === "object" && !Array.isArray(row.metadata) && row.metadata.source === "backfill",
    });
  }
  return grouped;
}

async function loadProfile(
  client: Client,
  userId: string,
  now: Date,
): Promise<DemoProfile> {
  const selected = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  fail("Load profile failed", selected.error);
  if (selected.data) return profileFromRow(selected.data);

  const fallback = createDemoProfile(now);
  const inserted = await client.from("profiles").insert({
    id: userId,
    display_name: fallback.displayName,
    timezone: fallback.timeZone,
    plan_start_date: fallback.planStartDate,
    daily_new_algorithm_count: fallback.dailyNewAlgorithmCount,
    daily_review_algorithm_count: fallback.dailyReviewAlgorithmCount,
    daily_new_knowledge_count: fallback.dailyNewKnowledgeCount,
    daily_review_knowledge_count: fallback.dailyReviewKnowledgeCount,
  }).select("*").single();
  if (inserted.error?.code === "23505") {
    // 重试或并发首载可能已创建默认 Profile；复用该行而不是让训练请求失败。
    const existing = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
    fail("Reload profile failed", existing.error);
    return profileFromRow(required(existing.data, "profile"));
  }
  fail("Create profile failed", inserted.error);
  return profileFromRow(required(inserted.data, "profile"));
}

async function insertTasks(client: Client, rows: DailyTaskInsert[]) {
  if (rows.length === 0) return;
  const result = await client.from("daily_tasks").insert(rows);
  if (result.error?.code !== "23505") fail("Create daily tasks failed", result.error);
}

export async function loadCloudTrainingSnapshot(
  client: Client,
  userId: string,
  now = new Date(),
): Promise<CloudTrainingSnapshot> {
  const profile = await loadProfile(client, userId, now);
  const [
    problemsResult,
    algorithmAttempts,
    algorithmStatesResult,
    knowledgeAttempts,
    knowledgeStatesResult,
    taskRows,
  ] = await Promise.all([
    client.from("algorithm_problems").select("*"),
    loadAllPages<AlgorithmAttempt>("Load algorithm attempts failed", (from, to) =>
      client
        .from("algorithm_attempts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at")
        .order("id")
        .range(from, to)),
    client.from("user_algorithm_state").select("*").eq("user_id", userId),
    loadAllPages<KnowledgeAttempt>("Load knowledge attempts failed", (from, to) =>
      client
        .from("knowledge_attempts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at")
        .order("id")
        .range(from, to)),
    client.from("user_knowledge_state").select("*").eq("user_id", userId),
    loadAllPages<DailyTask>("Load daily tasks failed", (from, to) =>
      client
        .from("daily_tasks")
        .select("*")
        .eq("user_id", userId)
        .order("task_date")
        .order("sort_order")
        .order("id")
        .range(from, to)),
  ]);
  fail("Load algorithm catalog failed", problemsResult.error);
  fail("Load algorithm state failed", algorithmStatesResult.error);
  fail("Load knowledge state failed", knowledgeStatesResult.error);

  const problemRows = required(problemsResult.data, "algorithm catalog");
  const localByDatabaseId = new Map(
    problemRows.map((row) => [row.id, String(row.leetcode_id)]),
  );
  const databaseByLocalId = new Map(
    problemRows.map((row) => [String(row.leetcode_id), row.id]),
  );
  if (
    databaseByLocalId.size !== algorithmCatalog.length ||
    algorithmCatalog.some((problem) => !databaseByLocalId.has(problem.id))
  ) {
    throw new Error("Supabase algorithm catalog is incomplete; run the seed first");
  }

  const algorithm = createAlgorithmDemoData(profile.planStartDate, profile.timeZone);
  for (const row of algorithmAttempts) {
    const problemId = localByDatabaseId.get(row.problem_id);
    if (!problemId) continue;
    const attempt = algorithmAttemptFromRow(row, problemId);
    if (attempt.finishedAt === null) algorithm.activeAttempts[problemId] = attempt;
    else algorithm.attempts.push(attempt);
  }
  for (const row of required(algorithmStatesResult.data, "algorithm states")) {
    const problemId = localByDatabaseId.get(row.problem_id);
    if (problemId) algorithm.states[problemId] = algorithmStateFromRow(row, problemId);
  }
  algorithm.dailyTasks = algorithmTasks(taskRows, localByDatabaseId);

  const knowledge = createKnowledgeDemoData(profile.planStartDate, profile.timeZone);
  knowledge.attempts = knowledgeAttempts.map(knowledgeAttemptFromRow);
  for (const row of required(knowledgeStatesResult.data, "knowledge states")) {
    knowledge.states[row.question_id] = knowledgeStateFromRow(row);
  }
  knowledge.dailyTasks = knowledgeTasks(taskRows);

  const ensuredAlgorithm = ensureTodayAlgorithmTasks(
    algorithm,
    algorithmCatalog.map(toAlgorithmPlannerProblem),
    now,
    {
      newCount: profile.dailyNewAlgorithmCount,
      reviewCount: profile.dailyReviewAlgorithmCount,
      timeZone: profile.timeZone,
    },
  );
  const ensuredKnowledge = ensureTodayKnowledgeTasks(
    knowledge,
    knowledgeQuestions.map(toKnowledgePlannerQuestion),
    now,
    {
      newCount: profile.dailyNewKnowledgeCount,
      reviewCount: profile.dailyReviewKnowledgeCount,
      timeZone: profile.timeZone,
    },
  );

  const inserts: DailyTaskInsert[] = [];
  if (ensuredAlgorithm.data !== algorithm) {
    for (const task of Object.values(ensuredAlgorithm.data.dailyTasks).flat().filter((task) => algorithm.dailyTasks[task.date] === undefined)) {
      inserts.push({
        user_id: userId,
        task_date: task.date,
        task_type: task.taskType,
        reason: task.reason,
        status: task.status,
        algorithm_problem_id: required(
          databaseByLocalId.get(task.problemId),
          "algorithm problem " + task.problemId,
        ),
        sort_order: task.sortOrder,
        completed_at: task.completedAt,
        metadata: { source: task.backfilled ? "backfill" : "deterministic_planner" },
      });
    }
  }
  if (ensuredKnowledge.data !== knowledge) {
    for (const task of Object.values(ensuredKnowledge.data.dailyTasks).flat().filter((task) => knowledge.dailyTasks[task.date] === undefined)) {
      inserts.push({
        user_id: userId,
        task_date: task.date,
        task_type: task.taskType,
        reason: task.reason,
        status: task.status,
        knowledge_question_id: task.questionId,
        sort_order: task.sortOrder,
        completed_at: task.completedAt,
        metadata: { source: task.backfilled ? "backfill" : "deterministic_planner" },
      });
    }
  }
  await insertTasks(client, inserts);
  return {
    algorithm: ensuredAlgorithm.data,
    knowledge: ensuredKnowledge.data,
    profile,
  };
}

async function resolveProblem(
  client: Client,
  problemId: string,
): Promise<{
  catalog: NonNullable<ReturnType<typeof getAlgorithmProblem>>;
  row: AlgorithmProblem;
}> {
  const catalog = getAlgorithmProblem(problemId);
  if (!catalog) throw new RangeError("Unknown Hot 100 problem");
  const selected = await client
    .from("algorithm_problems")
    .select("*")
    .eq("leetcode_id", catalog.leetcodeId)
    .single();
  fail("Load algorithm problem failed", selected.error);
  return { catalog, row: required(selected.data, "algorithm problem") };
}

function parseStartedAttempt(
  value: Json,
  userId: string,
  problemId: string,
): AlgorithmAttemptPayload {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    typeof value.id !== "string" ||
    typeof value.started_at !== "string"
  ) {
    throw new Error("Start algorithm attempt returned invalid data");
  }
  return {
    id: value.id,
    userId,
    problemId,
    startedAt: value.started_at,
    finishedAt: null,
    durationSeconds: null,
    result: null,
    independence: null,
    waCount: 0,
    mistakeTags: [],
    code: null,
    aiAnalysis: null,
    attemptScore: null,
    masteryBefore: null,
    masteryAfter: null,
  };
}

export async function startCloudAlgorithmAttempt(
  client: Client,
  userId: string,
  problemId: string,
  startedAt = new Date(),
): Promise<AlgorithmAttemptPayload> {
  const { row } = await resolveProblem(client, problemId);
  const profile = await loadProfile(client, userId, startedAt);
  const result = await client.rpc("start_algorithm_training_attempt", {
    p_attempt_id: crypto.randomUUID(),
    p_problem_id: row.id,
    p_started_at: startedAt.toISOString(),
    p_task_date: getAlgorithmTrainingDateKey(startedAt, profile.timeZone),
  });
  fail("Start algorithm attempt failed", result.error);
  return parseStartedAttempt(
    required(result.data, "started algorithm attempt"),
    userId,
    problemId,
  );
}

export async function cancelCloudAlgorithmAttempt(
  client: Client,
  userId: string,
  input: CancelCloudAlgorithmInput,
): Promise<void> {
  const { row: problem } = await resolveProblem(client, input.problemId);
  const deleted = await client
    .from("algorithm_attempts")
    .delete()
    .eq("id", input.attemptId)
    .eq("user_id", userId)
    .eq("problem_id", problem.id)
    .is("finished_at", null)
    .select("id")
    .maybeSingle();
  fail("Cancel algorithm attempt failed", deleted.error);
  if (!deleted.data) {
    throw new CloudTrainingConflictError("训练状态已在其他页面更新。");
  }

  const tasks = await client
    .from("daily_tasks")
    .update({ status: "pending", completed_at: null })
    .eq("user_id", userId)
    .eq("algorithm_problem_id", problem.id)
    .eq("status", "in_progress");
  fail("Restore algorithm tasks failed", tasks.error);
}

export async function importCloudAlgorithms(
  client: Client,
  userId: string,
  problemIds: readonly string[],
  importedAt = new Date(),
) {
  const uniqueIds = [...new Set(problemIds)];
  const problems = uniqueIds.map((id) => getAlgorithmProblem(id));
  if (
    uniqueIds.length === 0
    || uniqueIds.length > algorithmCatalog.length
    || problems.some((problem) => !problem)
  ) {
    throw new RangeError("只能导入 Hot 100 中的有效题目。");
  }
  if (!Number.isFinite(importedAt.getTime())) {
    throw new RangeError("导入时间无效。");
  }

  const selected = await client
    .from("algorithm_problems")
    .select("id, leetcode_id")
    .in("leetcode_id", problems.map((problem) => problem!.leetcodeId));
  fail("Load imported algorithm problems failed", selected.error);
  const problemRows = required(selected.data, "imported algorithm problems");
  if (problemRows.length !== uniqueIds.length) {
    throw new Error("Supabase algorithm catalog is incomplete");
  }

  const existing = await client
    .from("user_algorithm_state")
    .select("problem_id")
    .eq("user_id", userId)
    .in("problem_id", problemRows.map((problem) => problem.id));
  fail("Load imported algorithm states failed", existing.error);
  const existingIds = new Set(
    required(existing.data, "imported algorithm states").map((state) => state.problem_id),
  );
  const timestamp = importedAt.toISOString();
  const nextReviewAt = calculateNextAlgorithmReview(
    IMPORTED_ALGORITHM_MASTERY,
    importedAt,
  ).toISOString();
  const importedRows: UserAlgorithmStateInsert[] = problemRows
    .filter((problem) => !existingIds.has(problem.id))
    .map((problem) => ({
      user_id: userId,
      problem_id: problem.id,
      mastery: IMPORTED_ALGORITHM_MASTERY,
      attempt_count: 1,
      last_attempt_at: timestamp,
      next_review_at: nextReviewAt,
      status: "learning",
      last_result: "first_ac",
      independent_ac_count: 0,
      last_independent_ac_at: null,
      spaced_independent_ac_at: null,
    }));

  if (importedRows.length > 0) {
    const imported = await client
      .from("user_algorithm_state")
      .upsert(importedRows, {
        onConflict: "user_id,problem_id",
        ignoreDuplicates: true,
      });
    fail("Import algorithm states failed", imported.error);

    const completedTasks = await client
      .from("daily_tasks")
      .update({ status: "completed", completed_at: timestamp })
      .eq("user_id", userId)
      .in("algorithm_problem_id", importedRows.map((row) => row.problem_id))
      .in("status", ["pending", "in_progress"]);
    fail("Complete imported algorithm tasks failed", completedTasks.error);
  }

  return {
    importedCount: importedRows.length,
    skippedCount: uniqueIds.length - importedRows.length,
  };
}

export async function completeCloudAlgorithmAttempt(
  client: Client,
  userId: string,
  input: CompleteCloudAlgorithmInput,
): Promise<CompleteAlgorithmAttemptResult> {
  const { catalog, row: problem } = await resolveProblem(client, input.problemId);
  const [attemptResult, stateResult] = await Promise.all([
    client
      .from("algorithm_attempts")
      .select("*")
      .eq("id", input.attemptId)
      .eq("user_id", userId)
      .eq("problem_id", problem.id)
      .single(),
    client
      .from("user_algorithm_state")
      .select("*")
      .eq("user_id", userId)
      .eq("problem_id", problem.id)
      .maybeSingle(),
  ]);
  fail("Load open algorithm attempt failed", attemptResult.error);
  fail("Load algorithm state failed", stateResult.error);
  const attempt = required(attemptResult.data, "open algorithm attempt");
  if (attempt.finished_at !== null) {
    return {
      attempt: algorithmAttemptFromRow(attempt, input.problemId),
      state: algorithmStateFromRow(
        required(stateResult.data, "algorithm state for completed attempt"),
        input.problemId,
      ),
    };
  }
  const previousState = stateResult.data
    ? algorithmStateFromRow(stateResult.data, input.problemId)
    : null;
  const completed = completeAlgorithmAttempt({
    id: attempt.id,
    userId,
    problemId: input.problemId,
    difficulty: catalog.difficulty,
    startedAt: attempt.started_at,
    finishedAt: input.finishedAt,
    result: input.result,
    independence: input.independence,
    waCount: input.waCount,
    mistakeTags: input.mistakeTags,
    code: input.code,
    aiAnalysis: input.aiAnalysis,
    previousState,
  });
  const rpc = await client.rpc("complete_algorithm_training_attempt", {
    p_ai_analysis: completed.attempt.aiAnalysis ?? null,
    p_attempt_id: completed.attempt.id,
    p_attempt_score: required(completed.attempt.attemptScore, "attempt score"),
    p_code: completed.attempt.code,
    p_duration_seconds: required(completed.attempt.durationSeconds, "attempt duration"),
    p_finished_at: required(completed.attempt.finishedAt, "attempt finished_at"),
    p_independence: completed.attempt.independence,
    p_mastery_after: required(completed.attempt.masteryAfter, "attempt mastery_after"),
    p_mastery_before: completed.attempt.masteryBefore,
    p_mistake_tags: completed.attempt.mistakeTags,
    p_problem_id: problem.id,
    p_result: completed.attempt.result,
    p_state_attempt_count: completed.state.attemptCount,
    p_state_independent_ac_count: completed.state.independentAcCount,
    p_state_last_independent_ac_at: completed.state.lastIndependentAcAt,
    p_state_last_result: completed.state.lastResult,
    p_state_mastery: completed.state.mastery,
    p_state_next_review_at: completed.state.nextReviewAt,
    p_state_spaced_independent_ac_at: completed.state.spacedIndependentAcAt,
    p_state_status: completed.state.status,
    p_wa_count: completed.attempt.waCount,
  });
  fail("Complete algorithm attempt failed", rpc.error);
  return completed;
}

export async function saveCloudAlgorithmAnalysis(
  client: Client,
  userId: string,
  input: SaveCloudAlgorithmAnalysisInput,
): Promise<AlgorithmAttemptPayload> {
  if (!isAlgorithmCodeAnalysis(input.aiAnalysis)) {
    throw new RangeError("aiAnalysis is invalid");
  }

  const { row: problem } = await resolveProblem(client, input.problemId);
  const updated = await client
    .from("algorithm_attempts")
    .update({ ai_analysis: input.aiAnalysis as unknown as Json })
    .eq("id", input.attemptId)
    .eq("user_id", userId)
    .eq("problem_id", problem.id)
    .not("finished_at", "is", null)
    .not("code", "is", null)
    .select("*")
    .single();
  fail("Save algorithm AI analysis failed", updated.error);
  return algorithmAttemptFromRow(
    required(updated.data, "algorithm attempt with AI analysis"),
    input.problemId,
  );
}

export async function recordCloudKnowledgeAttempt(
  client: Client,
  userId: string,
  input: RecordCloudKnowledgeInput,
) {
  const question = getKnowledgeQuestion(input.questionId);
  if (!question) throw new RangeError("Unknown knowledge question");
  const [existingAttemptResult, stateResult] = await Promise.all([
    client
      .from("knowledge_attempts")
      .select("*")
      .eq("id", input.attemptId)
      .eq("user_id", userId)
      .eq("question_id", input.questionId)
      .maybeSingle(),
    client
      .from("user_knowledge_state")
      .select("*")
      .eq("user_id", userId)
      .eq("question_id", input.questionId)
      .maybeSingle(),
  ]);
  fail("Load existing knowledge attempt failed", existingAttemptResult.error);
  fail("Load knowledge state failed", stateResult.error);
  const previousState = stateResult.data
    ? knowledgeStateFromRow(stateResult.data)
    : null;
  if (existingAttemptResult.data) {
    return {
      attempt: knowledgeAttemptFromRow(existingAttemptResult.data),
      state: required(previousState, "knowledge state for completed attempt"),
    };
  }
  const identity = {
    id: input.attemptId,
    userId,
    questionId: input.questionId,
    attemptedAt: input.attemptedAt,
  };
  const result = input.mode === "learn"
    ? recordKnowledgeLearn({
        ...identity,
        selfRating: input.selfRating,
        previousState,
      })
    : recordKnowledgeRecall({
        ...identity,
        answerText: input.answerText,
        keyPoints: question.keyPoints,
        keywordAliases: question.keywordAliases,
        keyPointWeights: question.keyPointWeights,
        aiAnalysis: input.aiAnalysis ?? null,
        previousState: required(previousState, "previous knowledge state"),
      });
  const rpc = await client.rpc("record_knowledge_training_attempt", {
    p_answer_text: result.attempt.answerText,
    p_attempt_id: result.attempt.id,
    p_attempted_at: result.attempt.createdAt,
    p_coverage_score: result.attempt.coverageScore,
    p_effective_coverage_score: result.attempt.effectiveCoverageScore,
    p_ai_analysis: result.attempt.aiAnalysis,
    p_expected_attempt_count: previousState?.attemptCount ?? 0,
    p_mastery_after: result.attempt.masteryAfter,
    p_mastery_before: result.attempt.masteryBefore,
    p_matched_points: result.attempt.matchedPoints,
    p_missing_points: result.attempt.missingPoints,
    p_mode: result.attempt.mode,
    p_question_id: result.attempt.questionId,
    p_self_rating: result.attempt.selfRating,
    p_state_attempt_count: result.state.attemptCount,
    p_state_last_recall_at: result.state.lastRecallAt,
    p_state_last_recall_coverage_score: result.state.lastRecallCoverageScore,
    p_state_learn_count: result.state.learnCount,
    p_state_mastery: result.state.mastery,
    p_state_next_review_at: result.state.nextReviewAt,
    p_state_recall_count: result.state.recallCount,
    p_state_status: result.state.status,
  });
  fail("Record knowledge attempt failed", rpc.error);
  return result;
}

export async function updateCloudProfile(
  client: Client,
  userId: string,
  profile: DemoProfile,
): Promise<DemoProfile> {
  if (
    typeof profile.displayName !== "string" ||
    typeof profile.planStartDate !== "string" ||
    typeof profile.timeZone !== "string"
  ) {
    throw new RangeError("Profile fields are invalid");
  }
  const date = new Date(profile.planStartDate + "T00:00:00Z");
  if (
    profile.version !== 1 ||
    profile.displayName.trim().length > 50 ||
    !DEMO_TIME_ZONES.includes(profile.timeZone as DemoTimeZone) ||
    !Number.isFinite(date.getTime()) ||
    getAlgorithmDemoDateKey(date, "UTC") !== profile.planStartDate
  ) {
    throw new RangeError("Profile fields are invalid");
  }
  const counts = [
    profile.dailyNewAlgorithmCount,
    profile.dailyReviewAlgorithmCount,
    profile.dailyNewKnowledgeCount,
    profile.dailyReviewKnowledgeCount,
  ];
  if (counts.some((value) => !Number.isSafeInteger(value) || value < 0 || value > 100)) {
    throw new RangeError("Profile task counts must be integers between 0 and 100");
  }

  const result = await client.from("profiles").update({
    display_name: profile.displayName.trim() || null,
    timezone: profile.timeZone,
    plan_start_date: profile.planStartDate,
    daily_new_algorithm_count: profile.dailyNewAlgorithmCount,
    daily_review_algorithm_count: profile.dailyReviewAlgorithmCount,
    daily_new_knowledge_count: profile.dailyNewKnowledgeCount,
    daily_review_knowledge_count: profile.dailyReviewKnowledgeCount,
  }).eq("id", userId).select("*").single();
  fail("Update profile failed", result.error);
  return profileFromRow(required(result.data, "profile"));
}
