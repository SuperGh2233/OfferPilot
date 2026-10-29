import { DEFAULT_MODEL } from "@/lib/ai/openai";
import { getAiUserScope } from "@/lib/ai/request-settings";

export async function GET() {
  try {
    const scope = await getAiUserScope();
    if (!scope) return Response.json({ error: "请先登录。" }, { status: 401 });
    return Response.json({ scope, model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL, defaultConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "身份验证服务暂时不可用。" }, { status: 503 });
  }
}
