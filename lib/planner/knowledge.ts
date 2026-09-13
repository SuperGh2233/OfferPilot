import type { AlgorithmDateInput } from "../mastery/algorithm";

export type KnowledgePlannerQuestion = {
  id: string;
  questionType: "main" | "follow_up";
  isCore6Weeks: boolean;
  recommendedWeek: number | null;
  importance: number;
  sourceOrder: number;
};

export type KnowledgePlannerState = {
  questionId: string;
  mastery: number;
  attemptCount: number;
  nextReviewAt: AlgorithmDateInput | null;
};

export type KnowledgeTaskType = "new" | "review";

export type ExistingKnowledgeTask = {
  questionId: string;
  taskType: KnowledgeTaskType;
};

export type DailyKnowledgeTask = {
  questionId: string;
  taskType: KnowledgeTaskType;
  reason: "review_due" | `week_${number}_new`;
  sortOrder: number;
};

export type GenerateDailyKnowledgeTasksInput = {
  questions: readonly KnowledgePlannerQuestion[];
  states: readonly KnowledgePlannerState[];
  existingTasks?: readonly ExistingKnowledgeTask[];
  currentWeek: number;
  newCount?: number;
  reviewCount?: number;
  today: AlgorithmDateInput;
};

function assertNonNegativeInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function assertNonEmpty(value: string, name: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(`${name} must be a non-empty string`);
  }
}

function parseDate(value: AlgorithmDateInput, name: string) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new RangeError(`${name} must be a valid date`);
  return timestamp;
}

function validateQuestion(question: KnowledgePlannerQuestion, index: number) {
  assertNonEmpty(question.id, `questions[${index}].id`);
  if (question.questionType !== "main" && question.questionType !== "follow_up") {
    throw new RangeError(`questions[${index}].questionType is invalid`);
  }
  if (
    question.recommendedWeek !== null
    && (!Number.isSafeInteger(question.recommendedWeek)
      || question.recommendedWeek < 1
      || question.recommendedWeek > 4)
  ) {
    throw new RangeError(`questions[${index}].recommendedWeek must be 1..4 or null`);
  }
  if (!Number.isFinite(question.importance) || question.importance <= 0) {
    throw new RangeError(`questions[${index}].importance must be greater than 0`);
  }
  assertNonNegativeInteger(question.sourceOrder, `questions[${index}].sourceOrder`);
}

function validateState(state: KnowledgePlannerState, index: number) {
  assertNonEmpty(state.questionId, `states[${index}].questionId`);
  if (!Number.isFinite(state.mastery) || state.mastery < 0 || state.mastery > 100) {
    throw new RangeError(`states[${index}].mastery must be between 0 and 100`);
  }
  assertNonNegativeInteger(state.attemptCount, `states[${index}].attemptCount`);
  if (state.nextReviewAt !== null) {
    parseDate(state.nextReviewAt, `states[${index}].nextReviewAt`);
  }
}

function quotas(currentWeek: number, newCount: number, reviewCount: number) {
  const total = newCount + reviewCount;
  if (currentWeek === 5) return { newQuota: Math.min(1, total), reviewQuota: Math.max(0, total - 1) };
  if (currentWeek === 6) return { newQuota: 0, reviewQuota: total };
  return { newQuota: newCount, reviewQuota: reviewCount };
}

// Upper bound for overdue-review uplift, as a multiple of the configured quota.
const REVIEW_BACKLOG_MULTIPLIER = 3;

/**
 * Produces a deterministic, idempotent daily knowledge slice.
 *
 * Reviews are restricted to attempted states whose next review timestamp is at
 * or before today. New tasks are restricted to unattempted core main questions
 * in teaching order.
 *
 * When overdue reviews outnumber the configured review quota, the quota rises
 * to at most three times the configured amount (never beyond the overdue
 * count) so skipped days drain faster. An explicitly configured zero review
 * quota is respected and never uplifted.
 */
export function generateDailyKnowledgeTasks({
  questions,
  states,
  existingTasks = [],
  currentWeek,
  newCount = 3,
  reviewCount = 3,
  today,
}: GenerateDailyKnowledgeTasksInput): DailyKnowledgeTask[] {
  if (!Array.isArray(questions)) throw new RangeError("questions must be an array");
  if (!Array.isArray(states)) throw new RangeError("states must be an array");
  if (!Array.isArray(existingTasks)) throw new RangeError("existingTasks must be an array");
  if (!Number.isSafeInteger(currentWeek) || currentWeek < 1 || currentWeek > 6) {
    throw new RangeError("currentWeek must be between 1 and 6");
  }
  assertNonNegativeInteger(newCount, "newCount");
  assertNonNegativeInteger(reviewCount, "reviewCount");
  const todayTimestamp = parseDate(today, "today");

  const questionIds = new Set<string>();
  questions.forEach((question, index) => {
    validateQuestion(question, index);
    if (questionIds.has(question.id)) throw new RangeError(`duplicate question id: ${question.id}`);
    questionIds.add(question.id);
  });

  const statesById = new Map<string, KnowledgePlannerState>();
  states.forEach((state, index) => {
    validateState(state, index);
    if (statesById.has(state.questionId)) {
      throw new RangeError(`duplicate state questionId: ${state.questionId}`);
    }
    statesById.set(state.questionId, state);
  });

  const existingIds = new Set<string>();
  let existingNew = 0;
  let existingReview = 0;
  existingTasks.forEach((task, index) => {
    assertNonEmpty(task.questionId, `existingTasks[${index}].questionId`);
    if (task.taskType !== "new" && task.taskType !== "review") {
      throw new RangeError(`existingTasks[${index}].taskType is invalid`);
    }
    if (existingIds.has(task.questionId)) {
      throw new RangeError(`duplicate existing task questionId: ${task.questionId}`);
    }
    existingIds.add(task.questionId);
    if (task.taskType === "new") existingNew += 1;
    else existingReview += 1;
  });

  const plannedQuotas = quotas(currentWeek, newCount, reviewCount);
  const newQuota = Math.max(0, plannedQuotas.newQuota - existingNew);
  let reviewQuota = Math.max(0, plannedQuotas.reviewQuota - existingReview);

  const reviewCandidates = questions
    .map((question, index) => ({ question, state: statesById.get(question.id), index }))
    .filter(({ question, state }) =>
      !existingIds.has(question.id)
      && state !== undefined
      && state.attemptCount > 0
      && state.nextReviewAt !== null
      && parseDate(state.nextReviewAt, `state.${question.id}.nextReviewAt`) <= todayTimestamp,
    )
    .sort((left, right) => {
      const leftReviewAt = parseDate(left.state!.nextReviewAt!, "nextReviewAt");
      const rightReviewAt = parseDate(right.state!.nextReviewAt!, "nextReviewAt");
      return leftReviewAt - rightReviewAt
        || Number(right.question.isCore6Weeks) - Number(left.question.isCore6Weeks)
        || left.state!.mastery - right.state!.mastery
        || right.question.importance - left.question.importance
        || left.question.sourceOrder - right.question.sourceOrder
        || left.index - right.index;
    });

  if (reviewQuota > 0 && reviewCandidates.length > reviewQuota) {
    reviewQuota = Math.min(
      reviewCandidates.length,
      reviewQuota * REVIEW_BACKLOG_MULTIPLIER,
    );
  }

  const reviewTasks = reviewCandidates
    .slice(0, reviewQuota)
    .map(({ question }) => ({
      questionId: question.id,
      taskType: "review" as const,
      reason: "review_due" as const,
    }));

  const teachingWeek = Math.min(currentWeek, 4);
  const newTasks = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => {
      const state = statesById.get(question.id);
      return !existingIds.has(question.id)
        && question.questionType === "main"
        && question.isCore6Weeks
        && question.recommendedWeek !== null
        && question.recommendedWeek <= teachingWeek
        && (state === undefined || state.attemptCount === 0);
    })
    .sort((left, right) =>
      Number(right.question.recommendedWeek === teachingWeek)
      - Number(left.question.recommendedWeek === teachingWeek)
      || right.question.importance - left.question.importance
      || left.question.recommendedWeek! - right.question.recommendedWeek!
      || left.question.sourceOrder - right.question.sourceOrder
      || left.index - right.index,
    )
    .slice(0, newQuota)
    .map(({ question }) => ({
      questionId: question.id,
      taskType: "new" as const,
      reason: `week_${question.recommendedWeek}_new` as const,
    }));

  return [...reviewTasks, ...newTasks].map((task, index) => ({
    ...task,
    sortOrder: existingTasks.length + index,
  }));
}
