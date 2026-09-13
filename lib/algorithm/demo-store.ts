import {
  completeAlgorithmAttempt,
  startAlgorithmAttempt,
  type AlgorithmAttemptPayload,
  type AlgorithmStatePayload,
  type CompleteAlgorithmAttemptResult,
  type PreviousAlgorithmState,
} from "./attempts";
import {
  aggregateAlgorithmWeaknesses,
  generateDailyAlgorithmTasks,
  type AlgorithmPlannerProblem,
  type DailyAlgorithmTask,
} from "../planner/algorithm";
import type {
  AlgorithmDateInput,
  AlgorithmDifficulty,
  AlgorithmIndependence,
  AlgorithmMistakeTag,
  AlgorithmResult,
} from "../mastery/algorithm";
import {
  isAlgorithmCodeAnalysis,
  type AlgorithmCodeAnalysis,
} from "../ai/code-analysis";

export const ALGORITHM_DEMO_STORAGE_KEY = "offerpilot:algorithm-demo:v1";
export const ALGORITHM_DEMO_CHANGED_EVENT = "offerpilot:algorithm-changed";
export const ALGORITHM_DEMO_STORAGE_VERSION = 1 as const;
export const ALGORITHM_DEMO_USER_ID = "local-demo";
export const ALGORITHM_DEMO_TIME_ZONE = "Asia/Shanghai";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type LocalAlgorithmTaskStatus = "pending" | "in_progress" | "completed";

export type LocalAlgorithmTask = DailyAlgorithmTask & {
  date: string;
  status: LocalAlgorithmTaskStatus;
  completedAt: string | null;
};

export type AlgorithmDemoData = {
  version: typeof ALGORITHM_DEMO_STORAGE_VERSION;
  planStartDate: string;
  states: Record<string, AlgorithmStatePayload>;
  attempts: AlgorithmAttemptPayload[];
  activeAttempts: Record<string, AlgorithmAttemptPayload>;
  dailyTasks: Record<string, LocalAlgorithmTask[]>;
};

export type EnsureTodayAlgorithmTasksResult = {
  data: AlgorithmDemoData;
  tasks: LocalAlgorithmTask[];
  currentWeek: number;
  date: string;
};

export type StartDemoAlgorithmAttemptResult = {
  data: AlgorithmDemoData;
  attempt: AlgorithmAttemptPayload;
  resumed: boolean;
};

export type CompleteDemoAlgorithmAttemptInput = {
  problemId: string;
  difficulty: AlgorithmDifficulty;
  finishedAt: AlgorithmDateInput;
  result: AlgorithmResult;
  independence: AlgorithmIndependence;
  waCount: number;
  mistakeTags: readonly AlgorithmMistakeTag[];
  code?: string | null;
  aiAnalysis?: AlgorithmCodeAnalysis | null;
  timeZone?: string;
};

export type CompleteDemoAlgorithmAttemptResult = CompleteAlgorithmAttemptResult & {
  data: AlgorithmDemoData;
};

const VALID_RESULTS: readonly AlgorithmResult[] = [
  "first_ac",
  "wa_then_ac",
  "failed",
];
const VALID_INDEPENDENCE: readonly AlgorithmIndependence[] = [
  "independent",
  "small_hint",
  "solution_hint",
  "full_solution",
];
const VALID_MISTAKE_TAGS = [
  "no_idea",
  "wrong_idea",
  "boundary",
  "pointer",
  "state",
  "java_syntax",
  "java_api",
  "data_structure",
  "complexity",
  "careless",
] as const;
const VALID_STATUS = ["unlearned", "learning", "due", "mastered"] as const;
const VALID_TASK_TYPES = ["new", "review", "weakness"] as const;
const VALID_TASK_STATUSES = ["pending", "in_progress", "completed"] as const;
const VALID_TASK_REASONS = ["review_due", "weakness_related"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isWaCount(value: unknown): value is number {
  return isNonNegativeInteger(value) && value <= 3;
}

function isDate(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(new Date(value).getTime());
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseDate(value: AlgorithmDateInput, name: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError(`${name} must be a valid date`);
  }
  return date;
}

function dateKeyToUtc(dateKey: string): number {
  if (!isValidDateKey(dateKey)) {
    throw new RangeError("date must be a valid YYYY-MM-DD date");
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function getAlgorithmDemoDateKey(
  value: AlgorithmDateInput,
  timeZone: string = ALGORITHM_DEMO_TIME_ZONE,
): string {
  if (typeof value === "string" && isValidDateKey(value)) return value;
  const date = parseDate(value, "date");
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeDateKey(
  value: AlgorithmDateInput,
  name: string,
  timeZone: string = ALGORITHM_DEMO_TIME_ZONE,
): string {
  if (typeof value === "string" && isValidDateKey(value)) return value;
  try {
    return getAlgorithmDemoDateKey(value, timeZone);
  } catch {
    throw new RangeError(`${name} must be a valid date`);
  }
}

export function calculateAlgorithmCurrentWeek(
  planStartDate: AlgorithmDateInput,
  today: AlgorithmDateInput,
  timeZone: string = ALGORITHM_DEMO_TIME_ZONE,
): number {
  const startKey = normalizeDateKey(planStartDate, "planStartDate", timeZone);
  const todayKey = normalizeDateKey(today, "today", timeZone);
  const elapsedDays = Math.floor(
    (dateKeyToUtc(todayKey) - dateKeyToUtc(startKey)) / DAY_IN_MILLISECONDS,
  );
  return Math.min(6, Math.max(1, Math.floor(elapsedDays / 7) + 1));
}

export function createAlgorithmDemoData(
  planStartDate: AlgorithmDateInput = new Date(),
  timeZone: string = ALGORITHM_DEMO_TIME_ZONE,
): AlgorithmDemoData {
  return {
    version: ALGORITHM_DEMO_STORAGE_VERSION,
    planStartDate: normalizeDateKey(planStartDate, "planStartDate", timeZone),
    states: {},
    attempts: [],
    activeAttempts: {},
    dailyTasks: {},
  };
}

function isAlgorithmState(value: unknown): value is AlgorithmStatePayload {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.userId) &&
    isNonEmptyString(value.problemId) &&
    isFiniteNumber(value.mastery) &&
    value.mastery >= 0 &&
    value.mastery <= 100 &&
    isNonNegativeInteger(value.attemptCount) &&
    (value.lastAttemptAt === null || isDate(value.lastAttemptAt)) &&
    isDate(value.nextReviewAt) &&
    typeof value.status === "string" &&
    VALID_STATUS.includes(value.status as (typeof VALID_STATUS)[number]) &&
    typeof value.lastResult === "string" &&
    VALID_RESULTS.includes(value.lastResult as AlgorithmResult) &&
    isNonNegativeInteger(value.independentAcCount) &&
    (value.lastIndependentAcAt === null || isDate(value.lastIndependentAcAt)) &&
    (value.spacedIndependentAcAt === null || isDate(value.spacedIndependentAcAt))
  );
}

function isAlgorithmAttempt(value: unknown): value is AlgorithmAttemptPayload {
  if (!isRecord(value)) return false;
  const validResult =
    value.result === null ||
    (typeof value.result === "string" && VALID_RESULTS.includes(value.result as AlgorithmResult));
  const validIndependence =
    value.independence === null ||
    (typeof value.independence === "string" &&
      VALID_INDEPENDENCE.includes(value.independence as AlgorithmIndependence));
  const validDuration =
    value.durationSeconds === null || isNonNegativeInteger(value.durationSeconds);
  const validScore =
    value.attemptScore === null ||
    (isFiniteNumber(value.attemptScore) && value.attemptScore >= 0 && value.attemptScore <= 100);
  const validMastery =
    value.masteryBefore === null ||
    (isFiniteNumber(value.masteryBefore) && value.masteryBefore >= 0 && value.masteryBefore <= 100);
  const validMasteryAfter =
    value.masteryAfter === null ||
    (isFiniteNumber(value.masteryAfter) && value.masteryAfter >= 0 && value.masteryAfter <= 100);

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.userId) &&
    isNonEmptyString(value.problemId) &&
    isDate(value.startedAt) &&
    (value.finishedAt === null || isDate(value.finishedAt)) &&
    validDuration &&
    validResult &&
    validIndependence &&
    isWaCount(value.waCount) &&
    Array.isArray(value.mistakeTags) &&
    value.mistakeTags.every(
      (tag) =>
        typeof tag === "string" &&
        VALID_MISTAKE_TAGS.includes(tag as (typeof VALID_MISTAKE_TAGS)[number]),
    ) &&
    (value.code === null || typeof value.code === "string") &&
    (value.aiAnalysis === undefined ||
      value.aiAnalysis === null ||
      isAlgorithmCodeAnalysis(value.aiAnalysis)) &&
    validScore &&
    validMastery &&
    validMasteryAfter
  );
}

function isTaskReason(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (VALID_TASK_REASONS.includes(value as (typeof VALID_TASK_REASONS)[number])) return true;
  return /^week_[1-6]_new$/.test(value);
}

function isLocalAlgorithmTask(value: unknown): value is LocalAlgorithmTask {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.problemId) &&
    typeof value.taskType === "string" &&
    VALID_TASK_TYPES.includes(value.taskType as (typeof VALID_TASK_TYPES)[number]) &&
    isTaskReason(value.reason) &&
    isNonNegativeInteger(value.sortOrder) &&
    isValidDateKey(value.date) &&
    typeof value.status === "string" &&
    VALID_TASK_STATUSES.includes(value.status as (typeof VALID_TASK_STATUSES)[number]) &&
    (value.completedAt === null || isDate(value.completedAt))
  );
}

function isAlgorithmDemoData(value: unknown): value is AlgorithmDemoData {
  if (!isRecord(value)) return false;
  if (value.version !== ALGORITHM_DEMO_STORAGE_VERSION || !isValidDateKey(value.planStartDate)) {
    return false;
  }
  if (!isRecord(value.states) || !isRecord(value.activeAttempts) || !isRecord(value.dailyTasks)) {
    return false;
  }
  if (!Array.isArray(value.attempts) || !value.attempts.every(isAlgorithmAttempt)) {
    return false;
  }

  for (const [problemId, state] of Object.entries(value.states)) {
    if (problemId.trim().length === 0 || !isAlgorithmState(state) || state.problemId !== problemId) {
      return false;
    }
  }
  for (const [problemId, attempt] of Object.entries(value.activeAttempts)) {
    if (
      problemId.trim().length === 0 ||
      !isAlgorithmAttempt(attempt) ||
      attempt.problemId !== problemId ||
      attempt.finishedAt !== null ||
      attempt.result !== null ||
      attempt.independence !== null
    ) {
      return false;
    }
  }
  for (const [date, tasks] of Object.entries(value.dailyTasks)) {
    if (!isValidDateKey(date) || !Array.isArray(tasks) || !tasks.every(isLocalAlgorithmTask)) {
      return false;
    }
    const taskIds = new Set<string>();
    for (const task of tasks) {
      if (task.date !== date || taskIds.has(task.problemId)) return false;
      taskIds.add(task.problemId);
    }
  }

  const attemptIds = new Set<string>();
  for (const attempt of value.attempts) {
    if (attemptIds.has(attempt.id)) return false;
    attemptIds.add(attempt.id);
  }
  return true;
}

function assertAlgorithmDemoData(value: AlgorithmDemoData): void {
  if (!isAlgorithmDemoData(value)) {
    throw new RangeError("algorithm demo data is invalid");
  }
}

export function loadAlgorithmDemoData(
  storage: StorageLike,
  now: AlgorithmDateInput = new Date(),
  timeZone: string = ALGORITHM_DEMO_TIME_ZONE,
): AlgorithmDemoData {
  try {
    const raw = storage.getItem(ALGORITHM_DEMO_STORAGE_KEY);
    if (raw === null) return createAlgorithmDemoData(now, timeZone);
    const parsed: unknown = JSON.parse(raw);
    return isAlgorithmDemoData(parsed) ? parsed : createAlgorithmDemoData(now, timeZone);
  } catch {
    return createAlgorithmDemoData(now, timeZone);
  }
}

export function saveAlgorithmDemoData(
  storage: StorageLike,
  data: AlgorithmDemoData,
): boolean {
  try {
    assertAlgorithmDemoData(data);
    storage.setItem(ALGORITHM_DEMO_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function cloneData(data: AlgorithmDemoData): AlgorithmDemoData {
  return {
    ...data,
    states: { ...data.states },
    attempts: [...data.attempts],
    activeAttempts: { ...data.activeAttempts },
    dailyTasks: Object.fromEntries(
      Object.entries(data.dailyTasks).map(([date, tasks]) => [date, [...tasks]]),
    ),
  };
}

export function ensureTodayAlgorithmTasks(
  data: AlgorithmDemoData,
  problems: readonly AlgorithmPlannerProblem[],
  today: AlgorithmDateInput = new Date(),
  options: { newCount?: number; reviewCount?: number; timeZone?: string } = {},
): EnsureTodayAlgorithmTasksResult {
  assertAlgorithmDemoData(data);
  const timeZone = options.timeZone ?? ALGORITHM_DEMO_TIME_ZONE;
  const date = getAlgorithmDemoDateKey(today, timeZone);
  const currentWeek = calculateAlgorithmCurrentWeek(data.planStartDate, today, timeZone);
  const cachedTasks = data.dailyTasks[date];
  if (cachedTasks !== undefined) {
    return { data, tasks: cachedTasks, currentWeek, date };
  }

  const weaknesses = aggregateAlgorithmWeaknesses({
    attempts: data.attempts.map((attempt) => ({
      mistakeTags: attempt.mistakeTags,
      aiWeaknessTags: attempt.aiAnalysis?.weaknessTags,
    })),
  }).map(({ tag }) => tag);
  const tasks = generateDailyAlgorithmTasks({
    problems,
    states: Object.values(data.states),
    weaknessTags: weaknesses,
    currentWeek,
    newCount: options.newCount,
    reviewCount: options.reviewCount,
    today,
  }).map((task) => ({
    ...task,
    date,
    status: "pending" as const,
    completedAt: null,
  }));
  const nextData = cloneData(data);
  nextData.dailyTasks[date] = tasks;
  return { data: nextData, tasks, currentWeek, date };
}

function createAttemptId(problemId: string, startedAt: Date): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `local-${randomUuid}`;
  return `local-${startedAt.getTime()}-${problemId}`;
}

function startPendingTask(
  tasksByDate: Record<string, LocalAlgorithmTask[]>,
  dates: readonly string[],
  problemId: string,
) {
  const dateSet = new Set(dates);
  for (const date of Object.keys(tasksByDate)) {
    if (!dateSet.has(date)) continue;
    tasksByDate[date] = tasksByDate[date].map((task) =>
      task.problemId === problemId && task.status === "pending"
        ? { ...task, status: "in_progress", completedAt: null }
        : task,
    );
  }
}

function completeOutstandingTasks(
  tasksByDate: Record<string, LocalAlgorithmTask[]>,
  problemId: string,
  completedAt: string,
) {
  for (const date of Object.keys(tasksByDate)) {
    tasksByDate[date] = tasksByDate[date].map((task) =>
      task.problemId === problemId
        && (task.status === "pending" || task.status === "in_progress")
        ? { ...task, status: "completed", completedAt }
        : task,
    );
  }
}

export function startDemoAlgorithmAttempt({
  data,
  problemId,
  startedAt = new Date(),
  attemptId,
  timeZone = ALGORITHM_DEMO_TIME_ZONE,
}: {
  data: AlgorithmDemoData;
  problemId: string;
  startedAt?: AlgorithmDateInput;
  attemptId?: string;
  timeZone?: string;
}): StartDemoAlgorithmAttemptResult {
  assertAlgorithmDemoData(data);
  if (!isNonEmptyString(problemId)) throw new RangeError("problemId must be a non-empty string");

  const existing = data.activeAttempts[problemId];
  if (existing !== undefined) return { data, attempt: existing, resumed: true };

  const started = parseDate(startedAt, "startedAt");
  const id = attemptId ?? createAttemptId(problemId, started);
  if (
    !isNonEmptyString(id) ||
    data.attempts.some((attempt) => attempt.id === id) ||
    Object.values(data.activeAttempts).some((attempt) => attempt.id === id)
  ) {
    throw new RangeError("attemptId must be unique and non-empty");
  }

  const attempt = startAlgorithmAttempt({
    id,
    userId: ALGORITHM_DEMO_USER_ID,
    problemId,
    startedAt: started,
  });
  const nextData = cloneData(data);
  nextData.activeAttempts[problemId] = attempt;
  startPendingTask(
    nextData.dailyTasks,
    [getAlgorithmDemoDateKey(started, timeZone)],
    problemId,
  );
  return { data: nextData, attempt, resumed: false };
}

export function cancelDemoAlgorithmAttempt({
  data,
  problemId,
  attemptId,
}: {
  data: AlgorithmDemoData;
  problemId: string;
  attemptId: string;
}) {
  assertAlgorithmDemoData(data);
  const attempt = data.activeAttempts[problemId];
  if (!attempt || attempt.id !== attemptId) {
    throw new RangeError("no matching active attempt exists for problemId");
  }

  const nextData = cloneData(data);
  delete nextData.activeAttempts[problemId];
  for (const date of Object.keys(nextData.dailyTasks)) {
    nextData.dailyTasks[date] = nextData.dailyTasks[date].map((task) =>
      task.problemId === problemId && task.status === "in_progress"
        ? { ...task, status: "pending", completedAt: null }
        : task,
    );
  }
  return { data: nextData, attempt };
}

export function completeDemoAlgorithmAttempt({
  data,
  problemId,
  difficulty,
  finishedAt,
  result,
  independence,
  waCount,
  mistakeTags,
  code = null,
  aiAnalysis = null,
}: CompleteDemoAlgorithmAttemptInput & {
  data: AlgorithmDemoData;
}): CompleteDemoAlgorithmAttemptResult {
  assertAlgorithmDemoData(data);
  const active = data.activeAttempts[problemId];
  if (active === undefined) {
    throw new RangeError("no active attempt exists for problemId");
  }

  const completed = completeAlgorithmAttempt({
    id: active.id,
    userId: active.userId,
    problemId: active.problemId,
    difficulty,
    startedAt: active.startedAt,
    finishedAt,
    result,
    independence,
    waCount,
    mistakeTags,
    code,
    aiAnalysis,
    previousState: data.states[problemId] as PreviousAlgorithmState | undefined,
  });
  const finished = parseDate(finishedAt, "finishedAt");
  const finishedDate = finished.toISOString();
  const nextData = cloneData(data);
  nextData.attempts.push(completed.attempt);
  nextData.states[problemId] = completed.state;
  delete nextData.activeAttempts[problemId];
  completeOutstandingTasks(nextData.dailyTasks, problemId, finishedDate);

  return { ...completed, data: nextData };
}

export function attachDemoAlgorithmAnalysis({
  data,
  attemptId,
  problemId,
  aiAnalysis,
}: {
  data: AlgorithmDemoData;
  attemptId: string;
  problemId: string;
  aiAnalysis: AlgorithmCodeAnalysis;
}): { data: AlgorithmDemoData; attempt: AlgorithmAttemptPayload } {
  assertAlgorithmDemoData(data);
  if (!isAlgorithmCodeAnalysis(aiAnalysis)) {
    throw new RangeError("aiAnalysis must be valid");
  }

  const index = data.attempts.findIndex(
    (attempt) => attempt.id === attemptId && attempt.problemId === problemId,
  );
  const existing = data.attempts[index];
  if (!existing || !existing.finishedAt || !existing.code) {
    throw new RangeError("completed attempt with code was not found");
  }

  const attempt = { ...existing, aiAnalysis };
  const nextData = cloneData(data);
  nextData.attempts[index] = attempt;
  return { data: nextData, attempt };
}
