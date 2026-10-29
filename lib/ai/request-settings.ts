import { isLocalDemoMode } from "../supabase/env";
import type { OpenAiCodeAnalysisEnv } from "./openai";

export async function getAiUserScope(): Promise<string | null> {
  if (isLocalDemoMode()) return "demo";
  const { createClient } = await import("../supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export function personalAiEnv(request: Request, scope: string): { env?: OpenAiCodeAnalysisEnv; error?: Response } {
  const key = request.headers.get("x-offerpilot-ai-key");
  const user = request.headers.get("x-offerpilot-ai-user");
  if (key === null && user === null) return {};
  if (user !== scope) return { error: Response.json({ error: "账号已切换，请刷新页面后重试。" }, { status: 403 }) };
  if (!key || key.length > 512 || !/^[\x21-\x7e]+$/.test(key)) {
    return { error: Response.json({ error: "个人 API Key 格式无效，请在设置中检查。" }, { status: 400 }) };
  }
  return { env: { OPENAI_API_KEY: key, OPENAI_BASE_URL: process.env.OPENAI_BASE_URL, OPENAI_MODEL: process.env.OPENAI_MODEL } };
}
