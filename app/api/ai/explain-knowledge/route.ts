import { explainKnowledge } from "../../../../lib/ai/knowledge-understanding";
import {
  AiConfigurationError,
  AiGatewayError,
  AiInvalidResponseError,
  AiTimeoutError,
} from "../../../../lib/ai/openai";
import { getKnowledgeQuestion } from "../../../../lib/knowledge/catalog";
import { isLocalDemoMode } from "../../../../lib/supabase/env";

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!isLocalDemoMode()) {
    try {
      const { createClient } = await import("../../../../lib/supabase/server");
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      if (!data?.claims) return jsonError("请先登录后再使用理解教练。", 401);
    } catch (error) {
      console.error("Knowledge understanding authentication failed", { errorType: error instanceof Error ? error.name : "unknown" });
      return jsonError("身份验证服务暂时不可用，请稍后重试。", 503);
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("请求内容不是有效 JSON。", 400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) return jsonError("请求内容无效。", 400);
  const bodyRecord = body as Record<string, unknown>;
  const allowedKeys = new Set(["questionId", "confusionText"]);
  if (Object.keys(bodyRecord).some((key) => !allowedKeys.has(key))) return jsonError("请求内容无效。", 400);
  const { questionId, confusionText } = bodyRecord;
  if (typeof questionId !== "string" || (confusionText !== undefined && typeof confusionText !== "string")) {
    return jsonError("请求内容无效。", 400);
  }
  if (typeof confusionText === "string" && confusionText.length > 500) return jsonError("疑问不能超过 500 个字符。", 400);

  const question = getKnowledgeQuestion(questionId);
  if (!question || question.answerStatus !== "available" || (!question.shortAnswer.trim() && !question.interviewAnswer.trim())) {
    return jsonError("未找到可解释的八股题目。", 400);
  }

  try {
    const explanation = await explainKnowledge({
      questionId,
      question: question.question,
      shortAnswer: question.shortAnswer,
      interviewAnswer: question.interviewAnswer,
      keyPoints: question.keyPoints,
      confusionText,
    });
    return Response.json({ explanation });
  } catch (error) {
    if (error instanceof RangeError) return jsonError("题目内容无法用于理解教练。", 400);
    if (error instanceof AiConfigurationError) return jsonError("理解教练尚未配置，请先设置服务器端 OPENAI_API_KEY。", 503);
    if (error instanceof AiTimeoutError) return jsonError("理解教练超时，请稍后重试。", 504);
    if (error instanceof AiInvalidResponseError) return jsonError("理解教练返回内容无效，请重试。", 502);
    if (error instanceof AiGatewayError) return jsonError("AI 服务暂时不可用，请稍后重试。", 502);
    return jsonError("理解教练失败，请稍后重试。", 500);
  }
}
