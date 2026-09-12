export type AlgorithmDifficulty = "easy" | "medium" | "hard";

export type AlgorithmResult = "first_ac" | "wa_then_ac" | "failed";

export type AlgorithmIndependence =
  | "independent"
  | "small_hint"
  | "solution_hint"
  | "full_solution";

export type AlgorithmMistakeTag =
  | "no_idea"
  | "wrong_idea"
  | "boundary"
  | "pointer"
  | "state"
  | "java_syntax"
  | "java_api"
  | "data_structure"
  | "complexity"
  | "careless";

export type AlgorithmStateStatus =
  | "unlearned"
  | "learning"
  | "due"
  | "mastered";

export type AlgorithmAttemptScoreInput = {
  difficulty: AlgorithmDifficulty;
  durationSeconds: number;
  result: AlgorithmResult;
  independence: AlgorithmIndependence;
  waCount: number;
};

export type AlgorithmDateInput = Date | string;

export type AlgorithmMasteryUpdateInput = {
  oldMastery: number | null;
  attemptScore: number;
  result: AlgorithmResult;
  independence: AlgorithmIndependence;
  lastAttemptAt?: AlgorithmDateInput | null;
  attemptedAt: AlgorithmDateInput;
};

export type AlgorithmMasteredInput = {
  mastery: number;
  attemptCount: number;
  spacedIndependentAcAt: AlgorithmDateInput | null;
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const TIME_ADJUSTMENTS: Record<
  AlgorithmDifficulty,
  readonly [limitMinutes: number, adjustment: number][]
> = {
  easy: [
    [15, 5],
    [25, 0],
    [40, -5],
  ],
  medium: [
    [25, 5],
    [40, 0],
    [60, -5],
  ],
  hard: [
    [40, 5],
    [60, 0],
    [90, -5],
  ],
};

function assertValidInput({ durationSeconds, waCount }: AlgorithmAttemptScoreInput) {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new RangeError("durationSeconds must be a finite number greater than or equal to 0");
  }

  if (
    !Number.isFinite(waCount) ||
    !Number.isInteger(waCount) ||
    waCount < 0 ||
    waCount > 3
  ) {
    throw new RangeError("waCount must be an integer between 0 and 3");
  }
}

function calculateBaseScore(
  result: AlgorithmResult,
  independence: AlgorithmIndependence,
) {
  if (result === "failed") return 15;

  if (independence === "full_solution") return 30;
  if (independence === "solution_hint") return 50;
  if (independence === "small_hint") return 68;

  return result === "wa_then_ac" ? 78 : 85;
}

function calculateTimeAdjustment(
  difficulty: AlgorithmDifficulty,
  durationSeconds: number,
) {
  const durationMinutes = durationSeconds / 60;

  for (const [limitMinutes, adjustment] of TIME_ADJUSTMENTS[difficulty]) {
    if (durationMinutes <= limitMinutes) return adjustment;
  }

  return -10;
}

function calculateWaAdjustment(waCount: number) {
  if (waCount === 0) return 3;
  if (waCount === 1) return 0;
  if (waCount === 2) return -3;
  return -7;
}

function assertMastery(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be a finite number between 0 and 100`);
  }
}

function parseDate(value: AlgorithmDateInput, name: string) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    throw new RangeError(`${name} must be a valid date`);
  }

  return timestamp;
}

function roundAndClampMastery(value: number) {
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

export function calculateAlgorithmAttemptScore({
  difficulty,
  durationSeconds,
  result,
  independence,
  waCount,
}: AlgorithmAttemptScoreInput): number {
  assertValidInput({
    difficulty,
    durationSeconds,
    result,
    independence,
    waCount,
  });

  const score =
    calculateBaseScore(result, independence) +
    calculateTimeAdjustment(difficulty, durationSeconds) +
    calculateWaAdjustment(waCount);

  return Math.min(100, Math.max(0, score));
}

export function updateAlgorithmMastery({
  oldMastery,
  attemptScore,
  result,
  independence,
  lastAttemptAt = null,
  attemptedAt,
}: AlgorithmMasteryUpdateInput): number {
  if (oldMastery !== null) assertMastery(oldMastery, "oldMastery");
  assertMastery(attemptScore, "attemptScore");

  const attemptedTimestamp = parseDate(attemptedAt, "attemptedAt");
  const lastAttemptTimestamp =
    lastAttemptAt === null || lastAttemptAt === undefined
      ? null
      : parseDate(lastAttemptAt, "lastAttemptAt");

  if (
    lastAttemptTimestamp !== null &&
    lastAttemptTimestamp > attemptedTimestamp
  ) {
    throw new RangeError("lastAttemptAt must not be later than attemptedAt");
  }

  if (oldMastery === null) return roundAndClampMastery(attemptScore);

  const blended = oldMastery * 0.4 + attemptScore * 0.6;

  if (result === "failed") {
    return roundAndClampMastery(Math.min(blended, oldMastery - 15));
  }

  let reward = 0;
  if (independence === "independent" && lastAttemptTimestamp !== null) {
    const elapsedMilliseconds = attemptedTimestamp - lastAttemptTimestamp;
    if (elapsedMilliseconds >= 7 * DAY_IN_MILLISECONDS) reward = 5;
    else if (elapsedMilliseconds >= 3 * DAY_IN_MILLISECONDS) reward = 3;
  }

  return roundAndClampMastery(blended + reward);
}

export function calculateNextAlgorithmReview(
  mastery: number,
  from: AlgorithmDateInput,
): Date {
  assertMastery(mastery, "mastery");
  const fromTimestamp = parseDate(from, "from");

  const reviewDays =
    mastery < 40
      ? 1
      : mastery < 60
        ? 2
        : mastery < 75
          ? 3
          : mastery < 85
            ? 5
            : mastery < 92
              ? 7
              : 14;

  return new Date(fromTimestamp + reviewDays * DAY_IN_MILLISECONDS);
}

export function isAlgorithmMastered({
  mastery,
  attemptCount,
  spacedIndependentAcAt,
}: AlgorithmMasteredInput): boolean {
  assertMastery(mastery, "mastery");
  if (!Number.isInteger(attemptCount) || attemptCount < 0) {
    throw new RangeError("attemptCount must be a non-negative integer");
  }

  if (spacedIndependentAcAt === null || spacedIndependentAcAt === "") {
    return false;
  }

  parseDate(spacedIndependentAcAt, "spacedIndependentAcAt");
  return mastery >= 85 && attemptCount >= 2;
}
