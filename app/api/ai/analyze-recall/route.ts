import { analyzeKnowledgeRecall } from "../../../../lib/ai/knowledge-recall-analysis";
import {
  AiConfigurationError,
  AiGatewayError,
  AiInvalidResponseError,
  AiTimeoutError,
} from "../../../../lib/ai/openai";
import { getKnowledgeQuestion } from "../../../../lib/knowledge/catalog";
import { isLocalDemoMode } from "../../../../lib/supabase/env";
import { personalAiEnv } from "../../../../lib/ai/request-settings";

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  let scope = "demo";
  if (!isLocalDemoMode()) {
    try {
      const { createClient } = await import("../../../../lib/supabase/server");
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      if (!data?.claims) return jsonError("请先登录后再使用 AI 复核。", 401);
      if (typeof data.claims.sub !== "string") return jsonError("身份验证服务暂时不可用。", 503);
      scope = data.claims.sub;
    } catch (error) {
      console.error("AI authentication failed", error);
      return jsonError("身份验证服务暂时不可用，请稍后重试。", 503);
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("请求内容不是有效 JSON。", 400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("请求内容无效。", 400);
  }
  const { questionId, answerText } = body as Record<string, unknown>;
  if (typeof questionId !== "string" || typeof answerText !== "string" || !answerText.trim()) {
    return jsonError("请选择有效题目并填写回忆内容。", 400);
  }
  if (answerText.length > 5_000) return jsonError("回忆内容不能超过 5000 个字符。", 400);

  const question = getKnowledgeQuestion(questionId);
  if (!question || question.keyPoints.length === 0) return jsonError("未找到可分析的八股题目。", 400);

  const personal = personalAiEnv(request, scope);
  if (personal.error) return personal.error;

  try {
    const analysis = await analyzeKnowledgeRecall({
      questionId,
      question: question.question,
      answerText,
      keyPoints: question.keyPoints,
    }, { env: personal.env });
    return Response.json({ analysis });
  } catch (error) {
    if (error instanceof AiConfigurationError) {
      return jsonError("AI 复核尚未配置，请在设置中填写个人 API Key，或配置服务器默认密钥。", 503);
    }
    if (error instanceof AiTimeoutError) return jsonError("AI 复核超时，请稍后重试。", 504);
    if (error instanceof AiInvalidResponseError) return jsonError("AI 返回内容无效，请重新分析。", 502);
    if (error instanceof AiGatewayError) return jsonError("AI 服务暂时不可用，请稍后重试。", 502);
    return jsonError("AI 复核失败，请稍后重试。", 500);
  }
}
