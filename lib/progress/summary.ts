import { getAlgorithmDemoDateKey } from "../algorithm/demo-store";
import type { AlgorithmDateInput } from "../mastery/algorithm";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
export const FIRST_CYCLE_DAYS = 42;

export type SummaryTask = {
  date: string;
  status: "pending" | "in_progress" | "completed";
};

export type CyclePosition = {
  day: number;
  week: number;
  isFirstCycleComplete: boolean;
  progress: number;
};

export type ProgressState = {
  attemptCount: number;
  mastery: number;
  nextReviewAt: string;
  status: "unlearned" | "learning" | "due" | "mastered";
};

function dateKeyToMilliseconds(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new RangeError("date must use YYYY-MM-DD");
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new RangeError("date must be valid");
  }
  return timestamp;
}

function shiftDateKey(dateKey: string, days: number) {
  return new Date(dateKeyToMilliseconds(dateKey) + days * DAY_IN_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

export function calculateCyclePosition(
  planStartDate: string,
  today: AlgorithmDateInput,
  timeZone?: string,
): CyclePosition {
  const todayKey = getAlgorithmDemoDateKey(today, timeZone);
  const elapsedDays = Math.floor(
    (dateKeyToMilliseconds(todayKey) - dateKeyToMilliseconds(planStartDate))
      / DAY_IN_MILLISECONDS,
  );
  const day = Math.max(1, elapsedDays + 1);
  return {
    day,
    week: Math.min(6, Math.max(1, Math.floor(Math.max(0, elapsedDays) / 7) + 1)),
    isFirstCycleComplete: day > FIRST_CYCLE_DAYS,
    progress: Math.min(100, Math.round((day / FIRST_CYCLE_DAYS) * 100)),
  };
}

export function calculateWeeklyCompletion({
  planStartDate,
  tasks,
  today,
  timeZone,
}: {
  planStartDate: string;
  tasks: readonly SummaryTask[];
  today: AlgorithmDateInput;
  timeZone?: string;
}) {
  const position = calculateCyclePosition(planStartDate, today, timeZone);
  const weekStart = shiftDateKey(planStartDate, (position.week - 1) * 7);
  const weekEnd = shiftDateKey(weekStart, 6);
  const weeklyTasks = tasks.filter((task) => task.date >= weekStart && task.date <= weekEnd);
  const completed = weeklyTasks.filter((task) => task.status === "completed").length;
  return {
    completed,
    total: weeklyTasks.length,
    percentage: weeklyTasks.length === 0 ? 0 : Math.round((completed / weeklyTasks.length) * 100),
  };
}

export function calculateTrainingStreak(
  tasks: readonly SummaryTask[],
  today: AlgorithmDateInput,
  timeZone?: string,
) {
  const completedDates = new Set(
    tasks.filter((task) => task.status === "completed").map((task) => task.date),
  );
  let cursor = getAlgorithmDemoDateKey(today, timeZone);
  if (!completedDates.has(cursor)) cursor = shiftDateKey(cursor, -1);

  let streak = 0;
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function flattenDailyTasks<T extends SummaryTask>(
  dailyTasks: Record<string, readonly T[]>,
) {
  return Object.values(dailyTasks).flat();
}

export type BacklogReviewState = {
  attemptCount: number;
  nextReviewAt: string | null;
};

export type TrainingBacklog = {
  algorithmOverdueReviews: number;
  knowledgeOverdueReviews: number;
  algorithmLeftoverTasks: number;
  knowledgeLeftoverTasks: number;
  algorithmLearningGap: number;
  knowledgeLearningGap: number;
  missedTrainingDays: number;
};

type TrainingPlanCounts = {
  dailyNewAlgorithmCount: number;
  dailyReviewAlgorithmCount: number;
  dailyNewKnowledgeCount: number;
  dailyReviewKnowledgeCount: number;
  algorithmLearnedCount: number;
  knowledgeLearnedCount: number;
  algorithmCatalogSize: number;
  knowledgeCatalogSize: number;
};

function assertNonNegativeInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function plannedNewCountForDay(dayIndex: number, counts: TrainingPlanCounts) {
  const week = Math.floor(dayIndex / 7) + 1;
  const algorithmTotal = counts.dailyNewAlgorithmCount + counts.dailyReviewAlgorithmCount;
  const knowledgeTotal = counts.dailyNewKnowledgeCount + counts.dailyReviewKnowledgeCount;

  return {
    algorithm: week <= 3
      ? counts.dailyNewAlgorithmCount
      : week <= 5
        ? algorithmTotal - Math.round(algorithmTotal * 0.7)
        : 0,
    knowledge: week <= 4
      ? counts.dailyNewKnowledgeCount
      : week === 5
        ? Math.min(1, knowledgeTotal)
        : 0,
  };
}

/**
 * Summarizes catch-up workload that daily quotas alone do not surface:
 * overdue reviews (next review at or before now) plus tasks from earlier
 * dates in the current plan that were never completed. It also detects past
 * training days without any completed task, including dates for which no task
 * was generated, and compares learned catalog progress with planned new-item
 * quotas through yesterday. Tasks before the plan start and today's own tasks
 * are never "leftover" or missed.
 */
export function calculateTrainingBacklog({
  algorithmStates,
  knowledgeStates,
  algorithmDailyTasks,
  knowledgeDailyTasks,
  planStartDate,
  today,
  timeZone,
  dailyNewAlgorithmCount,
  dailyReviewAlgorithmCount,
  dailyNewKnowledgeCount,
  dailyReviewKnowledgeCount,
  algorithmLearnedCount,
  knowledgeLearnedCount,
  algorithmCatalogSize,
  knowledgeCatalogSize,
}: {
  algorithmStates: readonly BacklogReviewState[];
  knowledgeStates: readonly BacklogReviewState[];
  algorithmDailyTasks: Record<string, readonly SummaryTask[]>;
  knowledgeDailyTasks: Record<string, readonly SummaryTask[]>;
  planStartDate: AlgorithmDateInput;
  today: AlgorithmDateInput;
  timeZone?: string;
} & TrainingPlanCounts): TrainingBacklog {
  const planCounts: TrainingPlanCounts = {
    dailyNewAlgorithmCount,
    dailyReviewAlgorithmCount,
    dailyNewKnowledgeCount,
    dailyReviewKnowledgeCount,
    algorithmLearnedCount,
    knowledgeLearnedCount,
    algorithmCatalogSize,
    knowledgeCatalogSize,
  };
  for (const [name, value] of Object.entries(planCounts)) {
    assertNonNegativeInteger(value, name);
  }

  const now = today instanceof Date ? today.getTime() : new Date(today).getTime();
  if (!Number.isFinite(now)) throw new RangeError("today must be a valid date");
  const todayKey = getAlgorithmDemoDateKey(today, timeZone);
  const planStartKey = getAlgorithmDemoDateKey(planStartDate, timeZone);
  const planStartTimestamp = dateKeyToMilliseconds(planStartKey);
  const todayTimestamp = dateKeyToMilliseconds(todayKey);

  const countOverdue = (states: readonly BacklogReviewState[]) =>
    states.filter(
      (state) =>
        state.attemptCount > 0
        && state.nextReviewAt !== null
        && new Date(state.nextReviewAt).getTime() <= now,
    ).length;

  const countLeftover = (dailyTasks: Record<string, readonly SummaryTask[]>) =>
    flattenDailyTasks(dailyTasks).filter(
      (task) =>
        task.date >= planStartKey
        && task.date < todayKey
        && task.status !== "completed",
    ).length;

  const cycleTasks = [algorithmDailyTasks, knowledgeDailyTasks].flatMap(flattenDailyTasks);
  const scheduledDates = new Set(cycleTasks.map((task) => task.date));
  const completedDates = new Set(
    cycleTasks.filter((task) => task.status === "completed").map((task) => task.date),
  );
  const pastCycleDays = Math.min(
    FIRST_CYCLE_DAYS,
    Math.max(0, Math.floor((todayTimestamp - planStartTimestamp) / DAY_IN_MILLISECONDS)),
  );

  let missedTrainingDays = 0;
  let plannedAlgorithmNewCount = 0;
  let plannedKnowledgeNewCount = 0;
  for (let dayIndex = 0; dayIndex < pastCycleDays; dayIndex += 1) {
    const dateKey = shiftDateKey(planStartKey, dayIndex);
    const dailyPlanned = plannedNewCountForDay(dayIndex, planCounts);
    const hadPlannedWork = scheduledDates.has(dateKey)
      || dailyPlanned.algorithm + dailyPlanned.knowledge > 0;
    if (hadPlannedWork && !completedDates.has(dateKey)) missedTrainingDays += 1;
    plannedAlgorithmNewCount += dailyPlanned.algorithm;
    plannedKnowledgeNewCount += dailyPlanned.knowledge;
  }

  const algorithmLearningGap = Math.max(
    0,
    Math.min(algorithmCatalogSize, plannedAlgorithmNewCount) - algorithmLearnedCount,
  );
  const knowledgeLearningGap = Math.max(
    0,
    Math.min(knowledgeCatalogSize, plannedKnowledgeNewCount) - knowledgeLearnedCount,
  );

  return {
    algorithmOverdueReviews: countOverdue(algorithmStates),
    knowledgeOverdueReviews: countOverdue(knowledgeStates),
    algorithmLeftoverTasks: countLeftover(algorithmDailyTasks),
    knowledgeLeftoverTasks: countLeftover(knowledgeDailyTasks),
    algorithmLearningGap,
    knowledgeLearningGap,
    missedTrainingDays,
  };
}

export function calculateCatalogProgress(
  ids: readonly string[],
  states: Readonly<Record<string, ProgressState>>,
  today: AlgorithmDateInput,
) {
  const now = today instanceof Date ? today.getTime() : new Date(today).getTime();
  if (!Number.isFinite(now)) throw new RangeError("today must be a valid date");

  let learned = 0;
  let mastered = 0;
  let due = 0;
  for (const id of ids) {
    const state = states[id];
    if (!state || state.attemptCount === 0) continue;
    learned += 1;
    if (state.status === "mastered") mastered += 1;
    else if (new Date(state.nextReviewAt).getTime() <= now) due += 1;
  }
  return {
    total: ids.length,
    learned,
    mastered,
    due,
    unlearned: ids.length - learned,
    completion: ids.length === 0 ? 0 : Math.round((learned / ids.length) * 100),
  };
}

export function calculateWeightedMastery(
  items: readonly { id: string; weight: number }[],
  states: Readonly<Record<string, Pick<ProgressState, "mastery">>>,
) {
  let score = 0;
  let weight = 0;
  for (const item of items) {
    if (!Number.isFinite(item.weight) || item.weight <= 0) {
      throw new RangeError("item weight must be greater than zero");
    }
    score += (states[item.id]?.mastery ?? 0) * item.weight;
    weight += item.weight;
  }
  return weight === 0 ? 0 : Math.round((score / weight) * 100) / 100;
}
