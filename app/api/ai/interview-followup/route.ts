import {
  fallbackInterviewFollowUp,
  generateInterviewFollowUp,
  type InterviewCoachInput,
} from "../../../../lib/interview/ai-coach";
import { createInterviewCoachCompletion } from "../../../../lib/interview/ai-coach-server";
import { getKnowledgeQuestion } from "../../../../lib/knowledge/catalog";
import { matchKnowledgeKeyPoints } from "../../../../lib/knowledge/match";
import { isLocalDemoMode } from "../../../../lib/supabase/env";

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  if (!isLocalDemoMode()) {
    try {
      const { createClient } = await import("../../../../lib/supabase/server");
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      if (!data?.claims) return jsonError("请先登录后使用模拟面试追问。", 401);
    } catch {
      return jsonError("身份验证暂不可用。", 503);
    }
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 12_000) return jsonError("请求内容太长。", 413);
    body = JSON.parse(raw);
  } catch {
    return jsonError("请求内容不是有效 JSON。", 400);
  }
  if (!isRecord(body)) return jsonError("请求内容无效。", 400);

  const { questionId, answerText, priorFollowUps } = body;
  if (
    typeof questionId !== "string"
    || typeof answerText !== "string"
    || !answerText.trim()
    || answerText.length > 5_000
    || (
      priorFollowUps !== undefined
      && (
        !Array.isArray(priorFollowUps)
        || priorFollowUps.length > 3
        || priorFollowUps.some((value) =>
          typeof value !== "string" || !value.trim() || value.length > 1_000)
      )
    )
  ) {
    return jsonError("题目、答案或历史追问不符合要求。", 400);
  }

  const question = getKnowledgeQuestion(questionId);
  if (!question || question.keyPoints.length === 0) {
    return jsonError("未找到可追问的题目。", 400);
  }

  const match = matchKnowledgeKeyPoints({
    answer: answerText,
    keyPoints: question.keyPoints,
    keywordAliases: question.keywordAliases,
    keyPointWeights: question.keyPointWeights,
  });
  const input: InterviewCoachInput = {
    question: question.question,
    answer: answerText,
    keyPoints: question.keyPoints,
    missingPoints: match.missingPoints.map(({ index, point }) => ({ index, point })),
    priorFollowUps: (priorFollowUps ?? []) as string[],
  };

  try {
    const followUp = await generateInterviewFollowUp(
      input,
      createInterviewCoachCompletion("interview_follow_up"),
    );
    return Response.json({ followUp });
  } catch {
    return Response.json({ followUp: fallbackInterviewFollowUp(input) });
  }
}
