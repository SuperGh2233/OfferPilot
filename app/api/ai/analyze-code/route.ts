import { getAlgorithmProblem } from "../../../../lib/algorithm/catalog";
import {
  AiConfigurationError,
  AiGatewayError,
  AiInvalidResponseError,
  AiTimeoutError,
  analyzeJavaCode,
} from "../../../../lib/ai/openai";
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
      if (!data?.claims) return jsonError("请先登录后再使用 AI 分析。", 401);
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
  const { problemId, code } = body as Record<string, unknown>;
  if (typeof problemId !== "string" || typeof code !== "string" || !code.trim()) {
    return jsonError("请选择有效题目并粘贴非空 Java 代码。", 400);
  }
  if (code.length > 20_000) return jsonError("Java 代码不能超过 20000 个字符。", 400);

  const problem = getAlgorithmProblem(problemId);
  if (!problem) return jsonError("未找到对应的 Hot 100 题目。", 400);

  const personal = personalAiEnv(request, scope);
  if (personal.error) return personal.error;

  try {
    const analysis = await analyzeJavaCode({
      problemId,
      title: `${problem.title} / ${problem.titleEn}`,
      difficulty: problem.difficulty,
      tags: problem.tags,
      code,
    }, { env: personal.env });
    return Response.json({ analysis });
  } catch (error) {
    if (error instanceof AiConfigurationError) {
      return jsonError("AI 分析尚未配置，请在设置中填写个人 API Key，或配置服务器默认密钥。", 503);
    }
    if (error instanceof AiTimeoutError) return jsonError("AI 分析超时，请稍后重试。", 504);
    if (error instanceof AiInvalidResponseError) return jsonError("AI 返回内容无效，请重新分析。", 502);
    if (error instanceof AiGatewayError) return jsonError("AI 服务暂时不可用，请稍后重试。", 502);
    return jsonError("AI 分析失败，请稍后重试。", 500);
  }
}
