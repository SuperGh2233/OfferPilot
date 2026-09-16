import {
  matchKnowledgeKeyPoints,
  type KnowledgeKeywordAliases,
  type KnowledgeMatchedPoint,
  type KnowledgeMissingPoint,
  type KnowledgePointWeights,
} from "./match";
import {
  calculateKnowledgeLearnMastery,
  calculateKnowledgeRecallAttemptScore,
  calculateNextKnowledgeReview,
  isKnowledgeMastered,
  updateKnowledgeMastery,
  type KnowledgeSelfRating,
} from "../mastery/knowledge";
import type { AlgorithmDateInput, AlgorithmStateStatus } from "../mastery/algorithm";
// 仅类型引用：AI 分析结果会随 Attempt 落库，但领域层不依赖 AI 运行时。
import type { KnowledgeRecallAnalysis } from "../ai/knowledge-recall-analysis";

export type KnowledgeAttemptPayload = {
  id: string;
  userId: string;
  questionId: string;
  mode: "learn" | "recall";
  selfRating: KnowledgeSelfRating | null;
  answerText: string | null;
  /** 确定性加权覆盖率，口径不变，始终记录以便审计与校准。 */
  coverageScore: number | null;
  /** 当次实际计入 mastery 的覆盖率：max(确定性覆盖, AI 语义覆盖)；旧数据为 null 时按 coverageScore 处理。 */
  effectiveCoverageScore: number | null;
  /** AI 语义复核结果，未复核时为 null。 */
  aiAnalysis: KnowledgeRecallAnalysis | null;
  matchedPoints: KnowledgeMatchedPoint[];
  missingPoints: KnowledgeMissingPoint[];
  masteryBefore: number | null;
  masteryAfter: number;
  createdAt: string;
};

export type KnowledgeStatePayload = {
  userId: string;
  questionId: string;
  mastery: number;
  attemptCount: number;
  lastAttemptAt: string;
  nextReviewAt: string;
  status: AlgorithmStateStatus;
  learnCount: number;
  recallCount: number;
  lastRecallAt: string | null;
  lastRecallCoverageScore: number | null;
};

export type PreviousKnowledgeState = Omit<KnowledgeStatePayload, "userId" | "questionId"> &
  Partial<Pick<KnowledgeStatePayload, "userId" | "questionId">>;

type KnowledgeAttemptIdentity = {
  id: string;
  userId: string;
  questionId: string;
  attemptedAt: AlgorithmDateInput;
};

function assertNonEmpty(value: string, name: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(`${name} must be a non-empty string`);
  }
}

function parseDate(value: AlgorithmDateInput, name: string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError(`${name} must be a valid date`);
  return date;
}

function validateIdentity(input: KnowledgeAttemptIdentity) {
  assertNonEmpty(input.id, "id");
  assertNonEmpty(input.userId, "userId");
  assertNonEmpty(input.questionId, "questionId");
  return parseDate(input.attemptedAt, "attemptedAt");
}

function validatePreviousState(
  previous: PreviousKnowledgeState,
  userId: string,
  questionId: string,
  attemptedAt: Date,
) {
  if (previous.userId !== undefined && previous.userId !== userId) {
    throw new RangeError("previousState.userId must match userId");
  }
  if (previous.questionId !== undefined && previous.questionId !== questionId) {
    throw new RangeError("previousState.questionId must match questionId");
  }
  for (const [name, value] of [
    ["mastery", previous.mastery],
    ["lastRecallCoverageScore", previous.lastRecallCoverageScore],
  ] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      throw new RangeError(`previousState.${name} must be between 0 and 100`);
    }
  }
  for (const [name, value] of [
    ["attemptCount", previous.attemptCount],
    ["learnCount", previous.learnCount],
    ["recallCount", previous.recallCount],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`previousState.${name} must be a non-negative integer`);
    }
  }
  const lastAttemptAt = parseDate(previous.lastAttemptAt, "previousState.lastAttemptAt");
  if (lastAttemptAt > attemptedAt) {
    throw new RangeError("previousState.lastAttemptAt must not be later than attemptedAt");
  }
  parseDate(previous.nextReviewAt, "previousState.nextReviewAt");
  if (previous.lastRecallAt !== null) {
    parseDate(previous.lastRecallAt, "previousState.lastRecallAt");
  }
}

export function recordKnowledgeLearn({
  id,
  userId,
  questionId,
  attemptedAt,
  selfRating,
  previousState = null,
}: KnowledgeAttemptIdentity & {
  selfRating: KnowledgeSelfRating;
  previousState?: PreviousKnowledgeState | null;
}): { attempt: KnowledgeAttemptPayload; state: KnowledgeStatePayload } {
  const attempted = validateIdentity({ id, userId, questionId, attemptedAt });
  if (previousState !== null) {
    validatePreviousState(previousState, userId, questionId, attempted);
    if (previousState.attemptCount > 0 || previousState.learnCount > 0) {
      throw new RangeError("Learn can only be recorded for an unlearned question");
    }
  }

  const mastery = calculateKnowledgeLearnMastery(selfRating);
  const createdAt = attempted.toISOString();
  return {
    attempt: {
      id,
      userId,
      questionId,
      mode: "learn",
      selfRating,
      answerText: null,
      coverageScore: null,
      effectiveCoverageScore: null,
      aiAnalysis: null,
      matchedPoints: [],
      missingPoints: [],
      masteryBefore: previousState?.mastery ?? null,
      masteryAfter: mastery,
      createdAt,
    },
    state: {
      userId,
      questionId,
      mastery,
      attemptCount: 1,
      lastAttemptAt: createdAt,
      nextReviewAt: calculateNextKnowledgeReview(mastery, attempted).toISOString(),
      status: "learning",
      learnCount: 1,
      recallCount: 0,
      lastRecallAt: null,
      lastRecallCoverageScore: null,
    },
  };
}

/**
 * 合成当次计分所用的覆盖率：AI 主导、确定性为下界。
 *
 * AI 语义分可能来自客户端提交，所以这里再做一次防御性校验，
 * 不让越界或非整数数值进入 mastery 计算链。
 */
export function combineRecallCoverage(
  deterministicCoverageScore: number,
  aiAnalysis: KnowledgeRecallAnalysis | null,
) {
  if (!Number.isFinite(deterministicCoverageScore)) {
    throw new RangeError("deterministicCoverageScore must be a finite number");
  }
  if (aiAnalysis === null) return deterministicCoverageScore;
  const semanticScore = aiAnalysis.semanticScore;
  if (!Number.isSafeInteger(semanticScore) || semanticScore < 0 || semanticScore > 100) {
    throw new RangeError("aiAnalysis.semanticScore must be an integer between 0 and 100");
  }
  return Math.max(deterministicCoverageScore, semanticScore);
}

export function recordKnowledgeRecall({
  id,
  userId,
  questionId,
  attemptedAt,
  answerText,
  keyPoints,
  keywordAliases,
  keyPointWeights,
  aiAnalysis = null,
  previousState,
}: KnowledgeAttemptIdentity & {
  answerText: string;
  keyPoints: readonly string[];
  keywordAliases?: KnowledgeKeywordAliases | null;
  keyPointWeights?: KnowledgePointWeights | null;
  aiAnalysis?: KnowledgeRecallAnalysis | null;
  previousState: PreviousKnowledgeState;
}): {
  attempt: KnowledgeAttemptPayload;
  state: KnowledgeStatePayload;
  attemptScore: number;
  effectiveCoverageScore: number;
} {
  const attempted = validateIdentity({ id, userId, questionId, attemptedAt });
  validatePreviousState(previousState, userId, questionId, attempted);
  if (previousState.attemptCount === 0 || previousState.learnCount === 0) {
    throw new RangeError("Recall requires a previous Learn attempt");
  }

  const match = matchKnowledgeKeyPoints({
    answer: answerText,
    keyPoints,
    keywordAliases,
    keyPointWeights,
  });
  // AI 主导计分、确定性为下界：语义复核只能向上修正规则漏计，不会低于已验证的关键点命中。
  const effectiveCoverageScore = combineRecallCoverage(match.coverageScore, aiAnalysis);
  const attemptScore = calculateKnowledgeRecallAttemptScore(effectiveCoverageScore);
  const mastery = updateKnowledgeMastery({
    oldMastery: previousState.mastery,
    attemptScore,
    coverageScore: effectiveCoverageScore,
    lastRecallAt: previousState.lastRecallAt,
    recalledAt: attempted,
  });
  const recallCount = previousState.recallCount + 1;
  const createdAt = attempted.toISOString();
  const status = isKnowledgeMastered({ mastery, recallCount })
    ? "mastered"
    : "learning";

  return {
    attemptScore,
    effectiveCoverageScore,
    attempt: {
      id,
      userId,
      questionId,
      mode: "recall",
      selfRating: null,
      answerText,
      coverageScore: match.coverageScore,
      effectiveCoverageScore,
      aiAnalysis,
      matchedPoints: match.matchedPoints,
      missingPoints: match.missingPoints,
      masteryBefore: previousState.mastery,
      masteryAfter: mastery,
      createdAt,
    },
    state: {
      userId,
      questionId,
      mastery,
      attemptCount: previousState.attemptCount + 1,
      lastAttemptAt: createdAt,
      nextReviewAt: calculateNextKnowledgeReview(mastery, attempted).toISOString(),
      status,
      learnCount: previousState.learnCount,
      recallCount,
      lastRecallAt: createdAt,
      lastRecallCoverageScore: effectiveCoverageScore,
    },
  };
}
