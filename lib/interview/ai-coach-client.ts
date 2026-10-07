import {
  fallbackInterviewFollowUp,
  fallbackInterviewSummary,
  type InterviewCoachInput,
  type InterviewFollowUp,
  type InterviewSummary,
  type InterviewSummaryInput,
} from "./ai-coach";

export type FetchLike = (
  input: string,
  init: {
    method: "POST";
    headers: { "Content-Type": "application/json" };
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

type FollowUpRequest = {
  questionId: string;
  answerText: string;
  priorFollowUps?: readonly string[];
  fallbackInput: InterviewCoachInput;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseFollowUpEnvelope(value: unknown): InterviewFollowUp | null {
  if (!record(value) || !record(value.followUp)) return null;
  const followUp = value.followUp;
  if (typeof followUp.question !== "string" || !followUp.question.trim() ||
      followUp.question.length > 350) return null;
  if (typeof followUp.rationale !== "string" || !followUp.rationale.trim() ||
      followUp.rationale.length > 350) return null;
  const index = followUp.focusPointIndex;
  if (index !== null && (!Number.isSafeInteger(index) || Number(index) < 0)) return null;
  if (followUp.source !== "ai" && followUp.source !== "deterministic") return null;
  return {
    question: followUp.question,
    focusPointIndex: index as number | null,
    rationale: followUp.rationale,
    source: followUp.source,
  };
}

function parseSummaryEnvelope(value: unknown): InterviewSummary | null {
  if (!record(value) || !record(value.summary)) return null;
  const summary = value.summary;
  if (typeof summary.strengths !== "string" || !summary.strengths.trim() ||
      summary.strengths.length > 500) return null;
  if (typeof summary.improvements !== "string" || !summary.improvements.trim() ||
      summary.improvements.length > 500) return null;
  if (typeof summary.nextStep !== "string" || !summary.nextStep.trim() ||
      summary.nextStep.length > 500) return null;
  if (summary.source !== "ai" && summary.source !== "deterministic") return null;
  return {
    strengths: summary.strengths,
    improvements: summary.improvements,
    nextStep: summary.nextStep,
    source: summary.source,
  };
}

export async function requestInterviewFollowUp(
  request: FollowUpRequest,
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<InterviewFollowUp> {
  const fallback = fallbackInterviewFollowUp(request.fallbackInput);
  try {
    const response = await fetchImpl("/api/ai/interview-followup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: request.questionId,
        answerText: request.answerText,
        priorFollowUps: request.priorFollowUps ?? [],
      }),
      signal,
    });
    if (!response.ok) return fallback;
    const parsed = parseFollowUpEnvelope(await response.json());
    if (!parsed) return fallback;
    const validFocus = request.fallbackInput.missingPoints.length === 0
      ? parsed.focusPointIndex === null
      : parsed.focusPointIndex !== null
        && request.fallbackInput.missingPoints.some(
          (point) => point.index === parsed.focusPointIndex,
        );
    return validFocus ? parsed : fallback;
  } catch (error) {
    if (signal?.aborted) throw error;
    return fallback;
  }
}

export async function requestInterviewSummary(
  input: InterviewSummaryInput,
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<InterviewSummary> {
  const fallback = fallbackInterviewSummary(input);
  try {
    const response = await fetchImpl("/api/ai/interview-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    if (!response.ok) return fallback;
    return parseSummaryEnvelope(await response.json()) ?? fallback;
  } catch (error) {
    if (signal?.aborted) throw error;
    return fallback;
  }
}
