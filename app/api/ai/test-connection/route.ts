import OpenAI from "openai";
import { AiConfigurationError, getOpenAiCodeAnalysisConfig } from "@/lib/ai/openai";
import { getAiUserScope, personalAiEnv } from "@/lib/ai/request-settings";

function result(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let scope: string | null;
  try { scope = await getAiUserScope(); }
  catch { return result("身份验证服务暂时不可用，请稍后重试。", 503); }
  if (!scope) return result("请先登录后测试连接。", 401);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return result("请求格式无效。", 415);
  }
  const personal = personalAiEnv(request, scope);
  if (personal.error) return personal.error;

  const signal = AbortSignal.timeout(12_000);
  try {
    const config = getOpenAiCodeAnalysisConfig(personal.env);
    const client = new OpenAI({ ...config, timeout: 12_000, maxRetries: 0 });
    const body = {
      model: config.model,
      messages: [{ role: "user" as const, content: "Reply OK." }],
      max_completion_tokens: 8,
      enable_thinking: false,
    };
    const completion = await client.chat.completions.create(body, { signal });
    if (!completion.choices[0]?.message.content?.trim()) return result("模型未返回有效内容，请检查模型和网关配置。", 502);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AiConfigurationError) return result("尚未配置 API Key，请填写个人 Key 或配置服务器默认 Key。", 503);
    if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError || (error instanceof Error && error.name === "TimeoutError")) return result("连接超时，请检查网络或稍后重试。", 504);
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) return result("服务商拒绝了凭据（401），请检查 API Key。", 502);
      if (error.status === 403) return result("服务商拒绝访问（403），请检查账号或模型权限。", 502);
      if (error.status === 404) return result("服务商未找到接口或模型（404），请检查网关和模型配置。", 502);
      if (error.status === 429) return result("服务商请求受限（429），请检查额度或稍后重试。", 502);
      if (error.status && error.status >= 500) return result("服务商暂时不可用，请稍后重试。", 502);
    }
    return result("连接失败，请检查网络、网关或模型配置。", 502);
  }
}
