import {
  calculateAlgorithmAttemptScore,
  calculateNextAlgorithmReview,
  isAlgorithmMastered,
  updateAlgorithmMastery,
  type AlgorithmDateInput,
  type AlgorithmDifficulty,
  type AlgorithmIndependence,
  type AlgorithmMistakeTag,
  type AlgorithmResult,
  type AlgorithmStateStatus,
} from "../mastery/algorithm";
import type { AlgorithmCodeAnalysis } from "../ai/code-analysis";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export type StartAlgorithmAttemptInput = {
  id: string;
  userId: string;
  problemId: string;
  startedAt: AlgorithmDateInput;
};

export type AlgorithmAttemptPayload = {
  id: string;
  userId: string;
  problemId: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  result: AlgorithmResult | null;
  independence: AlgorithmIndependence | null;
  waCount: number;
  mistakeTags: AlgorithmMistakeTag[];
  code: string | null;
  aiAnalysis?: AlgorithmCodeAnalysis | null;
  attemptScore: number | null;
  masteryBefore: number | null;
  masteryAfter: number | null;
};

export type AlgorithmStatePayload = {
  userId: string;
  problemId: string;
  mastery: number;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextReviewAt: string;
  status: AlgorithmStateStatus;
  lastResult: AlgorithmResult;
  independentAcCount: number;
  lastIndependentAcAt: string | null;
  spacedIndependentAcAt: string | null;
};

export type PreviousAlgorithmState = Omit<
  AlgorithmStatePayload,
  "userId" | "problemId" | "nextReviewAt" | "status" | "lastResult"
> &
  Partial<
    Pick<
      AlgorithmStatePayload,
      "userId" | "problemId" | "nextReviewAt" | "status" | "lastResult"
    >
  >;

export type CompleteAlgorithmAttemptInput = {
  id: string;
  userId: string;
  problemId: string;
  difficulty: AlgorithmDifficulty;
  startedAt: AlgorithmDateInput;
  finishedAt: AlgorithmDateInput;
  result: AlgorithmResult;
  independence: AlgorithmIndependence;
  waCount: number;
  mistakeTags: readonly AlgorithmMistakeTag[];
  code?: string | null;
  aiAnalysis?: AlgorithmCodeAnalysis | null;
  previousState?: PreviousAlgorithmState | null;
};

export type CompleteAlgorithmAttemptResult = {
  attempt: AlgorithmAttemptPayload;
  state: AlgorithmStatePayload;
};

function assertNonEmpty(value: string, name: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(`${name} must be a non-empty string`);
  }
}

function parseDate(value: AlgorithmDateInput, name: string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  const timestamp = date.getTime();

  if (!Number.isFinite(timestamp)) {
    throw new RangeError(`${name} must be a valid date`);
  }

  return { date, timestamp };
}

function assertMastery(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be a finite number between 0 and 100`);
  }
}

function assertNonNegativeInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function validateIdentity({ id, userId, problemId }: {
  id?: string;
  userId: string;
  problemId: string;
}) {
  if (id !== undefined) assertNonEmpty(id, "id");
  assertNonEmpty(userId, "userId");
  assertNonEmpty(problemId, "problemId");
}

function validatePreviousState(
  previousState: PreviousAlgorithmState,
  userId: string,
  problemId: string,
) {
  validateIdentity({
    userId: previousState.userId ?? userId,
    problemId: previousState.problemId ?? problemId,
  });

  if (previousState.userId !== undefined && previousState.userId !== userId) {
    throw new RangeError("previousState.userId must match userId");
  }
  if (
    previousState.problemId !== undefined &&
    previousState.problemId !== problemId
  ) {
    throw new RangeError("previousState.problemId must match problemId");
  }

  assertMastery(previousState.mastery, "previousState.mastery");
  assertNonNegativeInteger(previousState.attemptCount, "previousState.attemptCount");
  assertNonNegativeInteger(
    previousState.independentAcCount,
    "previousState.independentAcCount",
  );

  if (previousState.lastAttemptAt !== null) {
    parseDate(previousState.lastAttemptAt, "previousState.lastAttemptAt");
  }
  if (previousState.nextReviewAt !== undefined && previousState.nextReviewAt !== null) {
    parseDate(previousState.nextReviewAt, "previousState.nextReviewAt");
  }
  if (previousState.lastIndependentAcAt !== null) {
    parseDate(
      previousState.lastIndependentAcAt,
      "previousState.lastIndependentAcAt",
    );
  }
  if (previousState.spacedIndependentAcAt !== null) {
    parseDate(
      previousState.spacedIndependentAcAt,
      "previousState.spacedIndependentAcAt",
    );
  }
}

function isIndependentAc(
  result: AlgorithmResult,
  independence: AlgorithmIndependence,
) {
  return result !== "failed" && independence === "independent";
}

export function startAlgorithmAttempt({
  id,
  userId,
  problemId,
  startedAt,
}: StartAlgorithmAttemptInput): AlgorithmAttemptPayload {
  validateIdentity({ id, userId, problemId });
  const started = parseDate(startedAt, "startedAt");

  return {
    id,
    userId,
    problemId,
    startedAt: started.date.toISOString(),
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

export function completeAlgorithmAttempt({
  id,
  userId,
  problemId,
  difficulty,
  startedAt,
  finishedAt,
  result,
  independence,
  waCount,
  mistakeTags,
  code = null,
  aiAnalysis = null,
  previousState = null,
}: CompleteAlgorithmAttemptInput): CompleteAlgorithmAttemptResult {
  validateIdentity({ id, userId, problemId });
  if (!Array.isArray(mistakeTags)) {
    throw new RangeError("mistakeTags must be an array");
  }

  const started = parseDate(startedAt, "startedAt");
  const finished = parseDate(finishedAt, "finishedAt");
  if (finished.timestamp < started.timestamp) {
    throw new RangeError("finishedAt must not be earlier than startedAt");
  }

  if (previousState !== null) {
    validatePreviousState(previousState, userId, problemId);
  }

  const durationSeconds = Math.floor(
    (finished.timestamp - started.timestamp) / 1000,
  );
  const attemptScore = calculateAlgorithmAttemptScore({
    difficulty,
    durationSeconds,
    result,
    independence,
    waCount,
  });
  const masteryBefore = previousState?.mastery ?? null;
  const masteryAfter = updateAlgorithmMastery({
    oldMastery: masteryBefore,
    attemptScore,
    result,
    independence,
    lastAttemptAt: previousState?.lastAttemptAt ?? null,
    attemptedAt: finished.date,
  });
  const nextReviewAt = calculateNextAlgorithmReview(masteryAfter, finished.date);

  const attemptCount = (previousState?.attemptCount ?? 0) + 1;
  const independentAc = isIndependentAc(result, independence);
  const previousLastAttemptAt = previousState?.lastAttemptAt ?? null;
  const spacedIndependentAc =
    independentAc && previousLastAttemptAt !== null
      ? finished.timestamp - parseDate(previousLastAttemptAt, "lastAttemptAt").timestamp >=
          3 * DAY_IN_MILLISECONDS
      : false;
  const spacedIndependentAcAt = spacedIndependentAc
    ? finished.date.toISOString()
    : previousState?.spacedIndependentAcAt ?? null;
  const independentAcCount =
    (previousState?.independentAcCount ?? 0) + (independentAc ? 1 : 0);
  const lastIndependentAcAt = independentAc
    ? finished.date.toISOString()
    : previousState?.lastIndependentAcAt ?? null;
  const status = isAlgorithmMastered({
    mastery: masteryAfter,
    attemptCount,
    spacedIndependentAcAt,
  })
    ? "mastered"
    : "learning";

  return {
    attempt: {
      id,
      userId,
      problemId,
      startedAt: started.date.toISOString(),
      finishedAt: finished.date.toISOString(),
      durationSeconds,
      result,
      independence,
      waCount,
      mistakeTags: [...mistakeTags],
      code,
      aiAnalysis,
      attemptScore,
      masteryBefore,
      masteryAfter,
    },
    state: {
      userId,
      problemId,
      mastery: masteryAfter,
      attemptCount,
      lastAttemptAt: finished.date.toISOString(),
      nextReviewAt: nextReviewAt.toISOString(),
      status,
      lastResult: result,
      independentAcCount,
      lastIndependentAcAt,
      spacedIndependentAcAt,
    },
  };
}
