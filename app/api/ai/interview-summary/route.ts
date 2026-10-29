import {
  fallbackInterviewSummary,
  generateInterviewSummary,
  validateSummaryInput,
  type InterviewSummaryInput,
} from "../../../../lib/interview/ai-coach";
import { createInterviewCoachCompletion } from "../../../../lib/interview/ai-coach-server";
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
      if (!data?.claims) return jsonError("请先登录后使用面试总结。", 401);
      if (typeof data.claims.sub !== "string") return jsonError("身份验证暂不可用。", 503);
      scope = data.claims.sub;
    } catch {
      return jsonError("身份验证暂不可用。", 503);
    }
  }

  let input: InterviewSummaryInput;
  try {
    const raw = await request.text();
    if (raw.length > 12_000) return jsonError("请求内容太长。", 413);
    input = JSON.parse(raw) as InterviewSummaryInput;
    validateSummaryInput(input);
  } catch {
    return jsonError("面试报告参数无效。", 400);
  }

  const personal = personalAiEnv(request, scope);
  if (personal.error) return personal.error;
  try {
    const summary = await generateInterviewSummary(
      input,
      createInterviewCoachCompletion("interview_summary", personal.env),
    );
    return Response.json({ summary });
  } catch {
    return Response.json({ summary: fallbackInterviewSummary(input) });
  }
}
