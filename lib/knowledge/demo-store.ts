import {
  recordKnowledgeLearn,
  recordKnowledgeRecall,
  type KnowledgeAttemptPayload,
  type KnowledgeStatePayload,
} from "./attempts";
import type {
  KnowledgeKeywordAliases,
  KnowledgePointWeights,
} from "./match";
import type { KnowledgeSelfRating } from "../mastery/knowledge";
import type { AlgorithmDateInput } from "../mastery/algorithm";
import type { KnowledgeRecallAnalysis } from "../ai/knowledge-recall-analysis";
import { isPlanPaused, type PlanPausePeriod } from "../profile/pause";
import {
  generateDailyKnowledgeTasks,
  knowledgeQuotasForWeek,
  type DailyKnowledgeTask,
  type KnowledgePlannerQuestion,
} from "../planner/knowledge";
import {
  ALGORITHM_DEMO_TIME_ZONE,
  calculateAlgorithmCurrentWeek,
  getAlgorithmDemoDateKey,
  getAlgorithmTrainingDateKey,
  pastPlanDateKeys,
  type StorageLike,
} from "../algorithm/demo-store";

export const KNOWLEDGE_DEMO_STORAGE_KEY = "offerpilot:knowledge-demo:v1";
export const KNOWLEDGE_DEMO_CHANGED_EVENT = "offerpilot:knowledge-changed";

export type LocalKnowledgeTask = DailyKnowledgeTask & {
  date: string;
  status: "pending" | "in_progress" | "completed";
  completedAt: string | null;
  backfilled?: boolean;
};

export type KnowledgeDemoData = {
  version: 1;
  planStartDate: string;
  states: Record<string, KnowledgeStatePayload>;
  attempts: KnowledgeAttemptPayload[];
  dailyTasks: Record<string, LocalKnowledgeTask[]>;
};

function date(value: AlgorithmDateInput, name: string) {
  const result = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(result.getTime())) throw new RangeError(`${name} must be a valid date`);
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function isDateKey(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function isNonNegativeInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isState(value: unknown): value is KnowledgeStatePayload {
  if (!isRecord(value)) return false;
  return typeof value.userId === "string"
    && typeof value.questionId === "string"
    && typeof value.mastery === "number"
    && value.mastery >= 0
    && value.mastery <= 100
    && isNonNegativeInteger(value.attemptCount)
    && isNonNegativeInteger(value.learnCount)
    && isNonNegativeInteger(value.recallCount)
    && isDate(value.lastAttemptAt)
    && isDate(value.nextReviewAt)
    && ["unlearned", "learning", "due", "mastered"].includes(String(value.status))
    && (value.lastRecallAt === null || isDate(value.lastRecallAt))
    && (value.lastRecallCoverageScore === null
      || (typeof value.lastRecallCoverageScore === "number"
        && value.lastRecallCoverageScore >= 0
        && value.lastRecallCoverageScore <= 100));
}

function isAttempt(value: unknown): value is KnowledgeAttemptPayload {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.userId === "string"
    && typeof value.questionId === "string"
    && (value.mode === "learn" || value.mode === "recall")
    && Array.isArray(value.matchedPoints)
    && Array.isArray(value.missingPoints)
    && typeof value.masteryAfter === "number"
    && value.masteryAfter >= 0
    && value.masteryAfter <= 100
    && isDate(value.createdAt);
}

function isTask(value: unknown): value is LocalKnowledgeTask {
  if (!isRecord(value)) return false;
  return typeof value.questionId === "string"
    && (value.taskType === "new" || value.taskType === "review")
    && typeof value.reason === "string"
    && isNonNegativeInteger(value.sortOrder)
    && isDateKey(value.date)
    && ["pending", "in_progress", "completed"].includes(String(value.status))
    && (value.backfilled === undefined || typeof value.backfilled === "boolean")
    && (value.completedAt === null || isDate(value.completedAt));
}

function isData(value: unknown): value is KnowledgeDemoData {
  if (!isRecord(value)
    || value.version !== 1
    || !isDateKey(value.planStartDate)
    || !isRecord(value.states)
    || !Array.isArray(value.attempts)
    || !value.attempts.every(isAttempt)
    || !isRecord(value.dailyTasks)) return false;

  if (!Object.entries(value.states).every(([id, state]) => isState(state) && state.questionId === id)) {
    return false;
  }
  const validTasks = Object.entries(value.dailyTasks).every(([taskDate, tasks]) =>
    isDateKey(taskDate)
    && Array.isArray(tasks)
    && tasks.every((task) => isTask(task) && task.date === taskDate)
    && new Set(tasks.map((task) => task.questionId)).size === tasks.length,
  );
  return validTasks
    && new Set(value.attempts.map((attempt) => attempt.id)).size === value.attempts.length;
}

export function createKnowledgeDemoData(
  planStartDate: AlgorithmDateInput = new Date(),
  timeZone: string = ALGORITHM_DEMO_TIME_ZONE,
): KnowledgeDemoData {
  return {
    version: 1,
    planStartDate: getAlgorithmDemoDateKey(planStartDate, timeZone),
    states: {},
    attempts: [],
    dailyTasks: {},
  };
}

/**
 * 旧版本地数据没有 AI 复核字段。这里补成显式 null，
 * 避免下游把 undefined 和"本次未做 AI 复核"混为一谈。
 */
function normalizeAttemptAiFields(data: KnowledgeDemoData): KnowledgeDemoData {
  return {
    ...data,
    attempts: data.attempts.map((attempt) => ({
      ...attempt,
      effectiveCoverageScore: attempt.effectiveCoverageScore ?? attempt.coverageScore,
      aiAnalysis: attempt.aiAnalysis ?? null,
    })),
  };
}

export function loadKnowledgeDemoData(
  storage: StorageLike,
  now: AlgorithmDateInput = new Date(),
  timeZone: string = ALGORITHM_DEMO_TIME_ZONE,
) {
  try {
    const raw = storage.getItem(KNOWLEDGE_DEMO_STORAGE_KEY);
    if (!raw) return createKnowledgeDemoData(now, timeZone);
    const parsed: unknown = JSON.parse(raw);
    return isData(parsed) ? normalizeAttemptAiFields(parsed) : createKnowledgeDemoData(now, timeZone);
  } catch {
    return createKnowledgeDemoData(now, timeZone);
  }
}

export function saveKnowledgeDemoData(storage: StorageLike, data: KnowledgeDemoData) {
  try {
    if (!isData(data)) return false;
    storage.setItem(KNOWLEDGE_DEMO_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function copy(data: KnowledgeDemoData): KnowledgeDemoData {
  return {
    ...data,
    states: { ...data.states },
    attempts: [...data.attempts],
    dailyTasks: Object.fromEntries(
      Object.entries(data.dailyTasks).map(([taskDate, tasks]) => [taskDate, [...tasks]]),
    ),
  };
}

export function ensureTodayKnowledgeTasks(
  data: KnowledgeDemoData,
  questions: readonly KnowledgePlannerQuestion[],
  today: AlgorithmDateInput = new Date(),
  options: { newCount?: number; reviewCount?: number; timeZone?: string; pausePeriods?: readonly PlanPausePeriod[] } = {},
) {
  if (!isData(data)) throw new RangeError("knowledge demo data is invalid");
  const timeZone = options.timeZone ?? ALGORITHM_DEMO_TIME_ZONE;
  // 训练日期与周次按当地墙上时间 03:00 重置；Planner 到期判断仍使用真实时刻。
  const taskDate = getAlgorithmTrainingDateKey(today, timeZone);
  const pauses = options.pausePeriods ?? [];
  const currentWeek = calculateAlgorithmCurrentWeek(data.planStartDate, taskDate, timeZone, pauses);
  if (isPlanPaused(pauses)) {
    return { data, tasks: data.dailyTasks[taskDate] ?? [], currentWeek, date: taskDate };
  }
  const pastDates = pastPlanDateKeys(data.planStartDate, taskDate, pauses);
  const configuredNew = options.newCount ?? 3;
  const configuredReview = options.reviewCount ?? 3;
  const coreIds = new Set(questions.filter((question) => question.questionType === "main" && question.isCore6Weeks).map((question) => question.id));
  const expectedNew = Math.min(coreIds.size, pastDates.reduce((total, pastDate) =>
    total + knowledgeQuotasForWeek(
      calculateAlgorithmCurrentWeek(data.planStartDate, pastDate, timeZone, pauses),
      configuredNew,
      configuredReview,
    ).newQuota, 0));
  const learned = [...coreIds].filter((id) => (data.states[id]?.attemptCount ?? 0) > 0).length;
  const pastTasks = pastDates.flatMap((pastDate) => data.dailyTasks[pastDate] ?? []);
  const pendingNew = pastTasks.filter((task) => task.taskType === "new" && task.status !== "completed").length;
  let toBackfill = Math.max(0, expectedNew - learned - pendingNew);
  const assigned = new Set(Object.values(data.dailyTasks).flat()
    .filter((task) => task.date >= data.planStartDate && task.taskType === "new")
    .map((task) => task.questionId));
  let next = data;
  for (const pastDate of pastDates) {
    if (toBackfill === 0) break;
    if (data.dailyTasks[pastDate] !== undefined) continue;
    const week = calculateAlgorithmCurrentWeek(data.planStartDate, pastDate, timeZone, pauses);
    const tasks: LocalKnowledgeTask[] = generateDailyKnowledgeTasks({
      questions: questions.filter((question) => !assigned.has(question.id)),
      states: Object.values(data.states),
      currentWeek: week,
      newCount: configuredNew,
      reviewCount: configuredReview,
      today,
    }).filter((task) => task.taskType === "new").slice(0, toBackfill).map((task) => ({
      ...task,
      date: pastDate,
      status: "pending",
      completedAt: null,
      backfilled: true,
    }));
    if (tasks.length === 0) continue;
    if (next === data) next = copy(data);
    next.dailyTasks[pastDate] = tasks;
    for (const task of tasks) assigned.add(task.questionId);
    toBackfill -= tasks.length;
  }
  const cached = next.dailyTasks[taskDate];
  if (cached) return { data: next, tasks: cached, currentWeek, date: taskDate };

  const tasks: LocalKnowledgeTask[] = generateDailyKnowledgeTasks({
    questions: questions.filter((question) => !assigned.has(question.id)),
    states: Object.values(data.states),
    currentWeek,
    newCount: options.newCount,
    reviewCount: options.reviewCount,
    today,
  }).map((task) => ({
    ...task,
    date: taskDate,
    status: "pending",
    completedAt: null,
  }));
  if (next === data) next = copy(data);
  next.dailyTasks[taskDate] = tasks;
  return { data: next, tasks, currentWeek, date: taskDate };
}

function attemptId(questionId: string, attemptedAt: Date) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `local-${randomId}` : `local-${attemptedAt.getTime()}-${questionId}`;
}

function finishTask(
  data: KnowledgeDemoData,
  questionId: string,
  completedAt: Date,
) {
  for (const taskDate of Object.keys(data.dailyTasks)) {
    data.dailyTasks[taskDate] = data.dailyTasks[taskDate].map((task) =>
      task.questionId === questionId
        && (task.status === "pending" || task.status === "in_progress")
        ? { ...task, status: "completed", completedAt: completedAt.toISOString() }
        : task,
    );
  }
}

export function learnDemoKnowledgeQuestion({
  data,
  questionId,
  selfRating,
  attemptedAt = new Date(),
  id,
}: {
  data: KnowledgeDemoData;
  questionId: string;
  selfRating: KnowledgeSelfRating;
  attemptedAt?: AlgorithmDateInput;
  id?: string;
  timeZone?: string;
}) {
  if (!isData(data)) throw new RangeError("knowledge demo data is invalid");
  const attempted = date(attemptedAt, "attemptedAt");
  const result = recordKnowledgeLearn({
    id: id ?? attemptId(questionId, attempted),
    userId: "local-demo",
    questionId,
    attemptedAt: attempted,
    selfRating,
    previousState: data.states[questionId],
  });
  const next = copy(data);
  next.attempts.push(result.attempt);
  next.states[questionId] = result.state;
  finishTask(next, questionId, attempted);
  return { ...result, data: next };
}

export function recallDemoKnowledgeQuestion({
  data,
  questionId,
  answerText,
  keyPoints,
  keywordAliases,
  keyPointWeights,
  aiAnalysis = null,
  attemptedAt = new Date(),
  id,
}: {
  data: KnowledgeDemoData;
  questionId: string;
  answerText: string;
  keyPoints: readonly string[];
  keywordAliases?: KnowledgeKeywordAliases | null;
  keyPointWeights?: KnowledgePointWeights | null;
  aiAnalysis?: KnowledgeRecallAnalysis | null;
  attemptedAt?: AlgorithmDateInput;
  id?: string;
  timeZone?: string;
}) {
  if (!isData(data)) throw new RangeError("knowledge demo data is invalid");
  const attempted = date(attemptedAt, "attemptedAt");
  const previousState = data.states[questionId];
  if (!previousState) throw new RangeError("Recall requires a learned question");
  const result = recordKnowledgeRecall({
    id: id ?? attemptId(questionId, attempted),
    userId: "local-demo",
    questionId,
    attemptedAt: attempted,
    answerText,
    keyPoints,
    keywordAliases,
    keyPointWeights,
    aiAnalysis,
    previousState,
  });
  const next = copy(data);
  next.attempts.push(result.attempt);
  next.states[questionId] = result.state;
  finishTask(next, questionId, attempted);
  return { ...result, data: next };
}
