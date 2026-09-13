import type { AlgorithmDateInput } from "../mastery/algorithm";

export type AlgorithmPlannerProblem = {
  id: string;
  tags: readonly string[];
  recommendedWeek: number;
  importance: number;
  orderIndex: number;
};

export type AlgorithmPlannerState = {
  problemId: string;
  mastery: number;
  attemptCount: number;
  nextReviewAt: AlgorithmDateInput | null;
};

export type AlgorithmTaskType = "new" | "review" | "weakness";

export type ExistingAlgorithmTask = {
  problemId: string;
  taskType: AlgorithmTaskType;
};

export type AlgorithmPlannerTaskReason =
  | "review_due"
  | "weakness_related"
  | `week_${number}_new`;

export type DailyAlgorithmTask = {
  problemId: string;
  taskType: AlgorithmTaskType;
  reason: AlgorithmPlannerTaskReason;
  sortOrder: number;
};

export type AlgorithmWeaknessAttempt = {
  mistakeTags?: readonly string[] | null;
  aiWeaknessTags?: readonly string[] | null;
};

export type AlgorithmWeakness = {
  tag: string;
  count: number;
};

export type AggregateAlgorithmWeaknessesInput = {
  attempts: readonly AlgorithmWeaknessAttempt[];
  limit?: number;
};

export type GenerateDailyAlgorithmTasksInput = {
  problems: readonly AlgorithmPlannerProblem[];
  states: readonly AlgorithmPlannerState[];
  existingTasks?: readonly ExistingAlgorithmTask[];
  weaknessTags?: readonly string[];
  currentWeek: number;
  newCount?: number;
  reviewCount?: number;
  today: AlgorithmDateInput;
};

const VALID_TASK_TYPES: readonly AlgorithmTaskType[] = [
  "new",
  "review",
  "weakness",
];

// Upper bound for overdue-review uplift, as a multiple of the configured quota.
const REVIEW_BACKLOG_MULTIPLIER = 3;

function assertArray(value: unknown, name: string): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new RangeError(`${name} must be an array`);
  }
}

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(`${name} must be a non-empty string`);
  }
}

function assertNonNegativeInteger(value: unknown, name: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function assertFiniteNumber(value: unknown, name: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

function parseDate(value: AlgorithmDateInput, name: string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError(`${name} must be a valid date`);
  }
  return date;
}

function normalizeTag(tag: unknown): string | null {
  if (typeof tag !== "string") return null;
  const normalized = tag.trim().toLocaleLowerCase("zh-CN");
  return normalized.length > 0 ? normalized : null;
}

function compareLexically(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizedTagSet(tags: readonly string[] | null | undefined, name: string) {
  if (tags === null || tags === undefined) return new Set<string>();
  assertArray(tags, name);

  const normalized = new Set<string>();
  for (const tag of tags) {
    const value = normalizeTag(tag);
    if (value !== null) normalized.add(value);
  }
  return normalized;
}

function problemHasWeaknessTag(
  problem: AlgorithmPlannerProblem,
  weaknessTags: ReadonlySet<string>,
) {
  for (const tag of problem.tags) {
    const normalized = normalizeTag(tag);
    if (normalized !== null && weaknessTags.has(normalized)) return true;
  }
  return false;
}

/**
 * Aggregates user-selected and optional AI-derived weakness tags.
 *
 * Each attempt contributes at most one count per normalized tag, even when a
 * tag appears in both sources. The input arrays and attempts are untouched.
 */
export function aggregateAlgorithmWeaknesses({
  attempts,
  limit,
}: AggregateAlgorithmWeaknessesInput): AlgorithmWeakness[] {
  assertArray(attempts, "attempts");
  if (limit !== undefined) assertNonNegativeInteger(limit, "limit");

  const counts = new Map<string, number>();
  for (const attempt of attempts) {
    if (attempt === null || typeof attempt !== "object") {
      throw new RangeError("attempts must contain objects");
    }

    const row = attempt as AlgorithmWeaknessAttempt;
    const tags = new Set<string>();
    for (const source of [row.mistakeTags, row.aiWeaknessTags]) {
      if (source === null || source === undefined) continue;
      assertArray(source, "attempt tags");
      for (const tag of source) {
        const normalized = normalizeTag(tag);
        if (normalized !== null) tags.add(normalized);
      }
    }

    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const result = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) =>
      right.count - left.count || compareLexically(left.tag, right.tag),
    );

  return limit === undefined ? result : result.slice(0, limit);
}

function validateProblem(problem: AlgorithmPlannerProblem, index: number) {
  assertNonEmptyString(problem.id, `problems[${index}].id`);
  assertArray(problem.tags, `problems[${index}].tags`);
  if (
    !Number.isSafeInteger(problem.recommendedWeek) ||
    problem.recommendedWeek < 1 ||
    problem.recommendedWeek > 6
  ) {
    throw new RangeError(`problems[${index}].recommendedWeek must be between 1 and 6`);
  }
  if (
    !Number.isSafeInteger(problem.importance) ||
    problem.importance < 1 ||
    problem.importance > 5
  ) {
    throw new RangeError(`problems[${index}].importance must be between 1 and 5`);
  }
  assertNonNegativeInteger(problem.orderIndex, `problems[${index}].orderIndex`);
}

function validateState(state: AlgorithmPlannerState, index: number) {
  assertNonEmptyString(state.problemId, `states[${index}].problemId`);
  assertFiniteNumber(state.mastery, `states[${index}].mastery`);
  if (state.mastery < 0 || state.mastery > 100) {
    throw new RangeError(`states[${index}].mastery must be between 0 and 100`);
  }
  assertNonNegativeInteger(state.attemptCount, `states[${index}].attemptCount`);
  if (state.nextReviewAt !== null && state.nextReviewAt !== undefined) {
    parseDate(state.nextReviewAt, `states[${index}].nextReviewAt`);
  }
}

function validateExistingTask(task: ExistingAlgorithmTask, index: number) {
  assertNonEmptyString(task.problemId, `existingTasks[${index}].problemId`);
  if (!VALID_TASK_TYPES.includes(task.taskType)) {
    throw new RangeError(`existingTasks[${index}].taskType is invalid`);
  }
}

function taskSortOrder(
  tasks: Omit<DailyAlgorithmTask, "sortOrder">[],
  startAt: number,
) {
  return tasks.map((task, index) => ({ ...task, sortOrder: startAt + index }));
}

function compareReviewCandidates(
  left: { problem: AlgorithmPlannerProblem; state: AlgorithmPlannerState; index: number },
  right: { problem: AlgorithmPlannerProblem; state: AlgorithmPlannerState; index: number },
  reviewDates: ReadonlyMap<string, number>,
) {
  return (
    left.state.mastery - right.state.mastery ||
    (reviewDates.get(left.problem.id) ?? 0) -
      (reviewDates.get(right.problem.id) ?? 0) ||
    left.problem.orderIndex - right.problem.orderIndex ||
    left.index - right.index
  );
}

function compareNewCandidates(
  left: { problem: AlgorithmPlannerProblem; isWeakness: boolean; index: number },
  right: { problem: AlgorithmPlannerProblem; isWeakness: boolean; index: number },
  currentWeek: number,
) {
  const leftCurrentWeek = left.problem.recommendedWeek === currentWeek ? 1 : 0;
  const rightCurrentWeek = right.problem.recommendedWeek === currentWeek ? 1 : 0;

  return (
    Number(right.isWeakness) - Number(left.isWeakness) ||
    (currentWeek <= 3 ? rightCurrentWeek - leftCurrentWeek : 0) ||
    right.problem.importance - left.problem.importance ||
    left.problem.orderIndex - right.problem.orderIndex ||
    left.index - right.index
  );
}

/**
 * Produces a deterministic, idempotent daily algorithm slice.
 *
 * Reviews are restricted to states whose next review timestamp is at or before
 * today. New tasks are restricted to problems with no state or zero attempts.
 *
 * When overdue reviews outnumber the configured review quota, the quota rises
 * to at most three times the configured amount (never beyond the overdue
 * count) so skipped days drain faster. An explicitly configured zero review
 * quota is respected and never uplifted.
 */
export function generateDailyAlgorithmTasks({
  problems,
  states,
  existingTasks = [],
  weaknessTags = [],
  currentWeek,
  newCount = 2,
  reviewCount = 1,
  today,
}: GenerateDailyAlgorithmTasksInput): DailyAlgorithmTask[] {
  assertArray(problems, "problems");
  assertArray(states, "states");
  assertArray(existingTasks, "existingTasks");
  assertArray(weaknessTags, "weaknessTags");
  if (!Number.isSafeInteger(currentWeek) || currentWeek < 1 || currentWeek > 6) {
    throw new RangeError("currentWeek must be an integer between 1 and 6");
  }
  assertNonNegativeInteger(newCount, "newCount");
  assertNonNegativeInteger(reviewCount, "reviewCount");
  const todayDate = parseDate(today, "today");
  const todayTimestamp = todayDate.getTime();

  const uniqueProblems: { problem: AlgorithmPlannerProblem; index: number }[] = [];
  const problemIds = new Set<string>();
  for (let index = 0; index < problems.length; index += 1) {
    const problem = problems[index];
    validateProblem(problem, index);
    if (problemIds.has(problem.id)) {
      throw new RangeError(`problems contains duplicate id: ${problem.id}`);
    }
    problemIds.add(problem.id);
    uniqueProblems.push({ problem, index });
  }

  const statesByProblemId = new Map<string, AlgorithmPlannerState>();
  for (let index = 0; index < states.length; index += 1) {
    const state = states[index];
    validateState(state, index);
    if (statesByProblemId.has(state.problemId)) {
      throw new RangeError(`states contains duplicate problemId: ${state.problemId}`);
    }
    statesByProblemId.set(state.problemId, state);
  }

  const existingIds = new Set<string>();
  let existingReviewCount = 0;
  let existingNewCount = 0;

  for (let index = 0; index < existingTasks.length; index += 1) {
    const task = existingTasks[index];
    validateExistingTask(task, index);
    if (existingIds.has(task.problemId)) {
      throw new RangeError(`existingTasks contains duplicate problemId: ${task.problemId}`);
    }
    existingIds.add(task.problemId);
    if (task.taskType === "review") existingReviewCount += 1;
    else existingNewCount += 1;
  }

  const weaknessSet = normalizedTagSet(weaknessTags, "weaknessTags");
  const totalQuota = newCount + reviewCount;
  let reviewQuota = reviewCount;
  let newQuota = newCount;
  if (currentWeek === 4 || currentWeek === 5) {
    reviewQuota = Math.round(totalQuota * 0.7);
    newQuota = totalQuota - reviewQuota;
  } else if (currentWeek === 6) {
    reviewQuota = totalQuota;
    newQuota = 0;
  }
  reviewQuota = Math.max(0, reviewQuota - existingReviewCount);
  newQuota = Math.max(0, newQuota - existingNewCount);

  const reviewDates = new Map<string, number>();
  const reviewCandidates: {
    problem: AlgorithmPlannerProblem;
    state: AlgorithmPlannerState;
    index: number;
  }[] = [];
  for (const item of uniqueProblems) {
    if (existingIds.has(item.problem.id)) continue;
    const state = statesByProblemId.get(item.problem.id);
    if (state?.nextReviewAt === null || state?.nextReviewAt === undefined) continue;
    const nextReviewTimestamp = parseDate(
      state.nextReviewAt,
      `states.${item.problem.id}.nextReviewAt`,
    ).getTime();
    if (nextReviewTimestamp > todayTimestamp) continue;
    reviewDates.set(item.problem.id, nextReviewTimestamp);
    reviewCandidates.push({ ...item, state });
  }
  reviewCandidates.sort((left, right) =>
    compareReviewCandidates(left, right, reviewDates),
  );

  if (reviewQuota > 0 && reviewCandidates.length > reviewQuota) {
    reviewQuota = Math.min(
      reviewCandidates.length,
      reviewQuota * REVIEW_BACKLOG_MULTIPLIER,
    );
  }

  const selected: Omit<DailyAlgorithmTask, "sortOrder">[] = reviewCandidates
    .slice(0, reviewQuota)
    .map(({ problem }) => ({
      problemId: problem.id,
      taskType: "review",
      reason: "review_due",
    }));

  if (newQuota > 0 && currentWeek !== 6) {
    const newCandidates = uniqueProblems
      .filter(({ problem }) => {
        if (existingIds.has(problem.id)) return false;
        const state = statesByProblemId.get(problem.id);
        return state === undefined || state.attemptCount === 0;
      })
      .map(({ problem, index }) => ({
        problem,
        index,
        isWeakness: problemHasWeaknessTag(problem, weaknessSet),
      }));

    newCandidates.sort((left, right) =>
      compareNewCandidates(left, right, currentWeek),
    );
    const newTasks: Omit<DailyAlgorithmTask, "sortOrder">[] = newCandidates
      .slice(0, newQuota)
      .map(({ problem, isWeakness }) => ({
        problemId: problem.id,
        taskType: isWeakness ? ("weakness" as const) : ("new" as const),
        reason: isWeakness
          ? "weakness_related"
          : (`week_${currentWeek}_new` as const),
      }));
    selected.push(...newTasks);
  }

  return taskSortOrder(selected, existingTasks.length);
}
