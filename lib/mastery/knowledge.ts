import type { AlgorithmDateInput } from "./algorithm";

export type KnowledgeSelfRating = 1 | 2 | 3 | 4;

export type KnowledgeMasteryUpdateInput = {
  oldMastery: number | null;
  attemptScore: number;
  coverageScore: number;
  lastRecallAt?: AlgorithmDateInput | null;
  recalledAt: AlgorithmDateInput;
};

export type KnowledgeTopicQuestion = {
  mastery: number | null;
  importance: number;
  questionType: "main" | "follow_up";
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const LEARN_MASTERY: Record<KnowledgeSelfRating, number> = {
  1: 15,
  2: 30,
  3: 45,
  4: 55,
};

function assertScore(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be between 0 and 100`);
  }
}

function parseDate(value: AlgorithmDateInput, name: string) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new RangeError(`${name} must be a valid date`);
  return timestamp;
}

function roundScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

export function calculateKnowledgeLearnMastery(rating: KnowledgeSelfRating) {
  const mastery = LEARN_MASTERY[rating];
  if (mastery === undefined) throw new RangeError("rating must be an integer between 1 and 4");
  return mastery;
}

export function calculateKnowledgeRecallAttemptScore(coverageScore: number) {
  assertScore(coverageScore, "coverageScore");
  if (coverageScore <= 20) return 25;
  if (coverageScore <= 40) return 40;
  if (coverageScore <= 60) return 55;
  if (coverageScore < 80) return 70;
  return 85;
}

export function updateKnowledgeMastery({
  oldMastery,
  attemptScore,
  coverageScore,
  lastRecallAt = null,
  recalledAt,
}: KnowledgeMasteryUpdateInput) {
  if (oldMastery !== null) assertScore(oldMastery, "oldMastery");
  assertScore(attemptScore, "attemptScore");
  assertScore(coverageScore, "coverageScore");

  const recalledTimestamp = parseDate(recalledAt, "recalledAt");
  const previousTimestamp = lastRecallAt === null
    ? null
    : parseDate(lastRecallAt, "lastRecallAt");
  if (previousTimestamp !== null && previousTimestamp > recalledTimestamp) {
    throw new RangeError("lastRecallAt must not be later than recalledAt");
  }

  const blended = oldMastery === null
    ? attemptScore
    : oldMastery * 0.4 + attemptScore * 0.6;
  const retained = previousTimestamp !== null
    && recalledTimestamp - previousTimestamp >= 7 * DAY_IN_MILLISECONDS
    && coverageScore >= 80;

  return roundScore(retained ? Math.max(blended, 90) : blended);
}

export function calculateNextKnowledgeReview(
  mastery: number,
  from: AlgorithmDateInput,
) {
  assertScore(mastery, "mastery");
  const fromTimestamp = parseDate(from, "from");
  const reviewDays = mastery < 30
    ? 1
    : mastery < 45
      ? 2
      : mastery < 60
        ? 3
        : mastery < 75
          ? 5
          : mastery < 85
            ? 7
            : mastery < 92
              ? 14
              : 21;
  return new Date(fromTimestamp + reviewDays * DAY_IN_MILLISECONDS);
}

export function isKnowledgeMastered({
  mastery,
  recallCount,
}: {
  mastery: number;
  recallCount: number;
}) {
  assertScore(mastery, "mastery");
  if (!Number.isSafeInteger(recallCount) || recallCount < 0) {
    throw new RangeError("recallCount must be a non-negative integer");
  }
  return mastery >= 85 && recallCount >= 1;
}

export function calculateKnowledgeTopicMastery(
  questions: readonly KnowledgeTopicQuestion[],
) {
  if (!Array.isArray(questions)) throw new RangeError("questions must be an array");

  let weightedMastery = 0;
  let totalWeight = 0;
  for (const question of questions) {
    const mastery = question.mastery ?? 0;
    assertScore(mastery, "question.mastery");
    if (!Number.isFinite(question.importance) || question.importance <= 0) {
      throw new RangeError("question.importance must be greater than 0");
    }
    if (question.questionType !== "main" && question.questionType !== "follow_up") {
      throw new RangeError("question.questionType is invalid");
    }

    const weight = question.importance * (question.questionType === "main" ? 1 : 0.5);
    weightedMastery += mastery * weight;
    totalWeight += weight;
  }

  return totalWeight === 0 ? 0 : roundScore(weightedMastery / totalWeight);
}
