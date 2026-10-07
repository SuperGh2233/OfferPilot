import {
  AiConfigurationError,
  AiGatewayError,
  AiInvalidResponseError,
  AiTimeoutError,
} from "../../../../lib/ai/openai";
import {
  MAX_AUDIO_BASE64_LENGTH,
  normalizeTranscriptionMimeType,
  transcribeAudioWithFallback,
} from "../../../../lib/ai/transcription";
import { isLocalDemoMode } from "../../../../lib/supabase/env";

/** FunASR 失败后还可能执行百炼回退，给两个有界请求留出总时限。 */
export const maxDuration = 60;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  if (!isLocalDemoMode()) {
    try {
      const { createClient } = await import("../../../../lib/supabase/server");
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      if (!data?.claims) return jsonError("请先登录后再使用语音输入。", 401);
    } catch (error) {
      console.error("AI authentication failed", { errorType: error instanceof Error ? error.name : "unknown" });
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

  const { audioBase64, mimeType } = body as Record<string, unknown>;
  if (typeof audioBase64 !== "string" || !audioBase64.trim()) {
    return jsonError("没有收到录音数据，请重新录制。", 400);
  }
  if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
    return jsonError("录音太长了，请控制在 30 秒以内。", 400);
  }
  if (!normalizeTranscriptionMimeType(mimeType)) {
    return jsonError("录音格式不受支持，请重新录制。", 400);
  }

  try {
    const result = await transcribeAudioWithFallback({ audioBase64, mimeType: mimeType as string });
    console.info("AI transcription completed", {
      provider: result.provider,
      fallback: result.fallback,
      durationMs: Date.now() - startedAt,
    });
    if (!result.text) {
      return jsonError("没有识别到语音内容，请靠近麦克风重试。", 422);
    }
    return Response.json({ text: result.text });
  } catch (error) {
    console.warn("AI transcription failed", {
      errorType: error instanceof Error ? error.name : "unknown",
      durationMs: Date.now() - startedAt,
    });
    if (error instanceof RangeError) {
      return jsonError("录音数据无效，请重新录制。", 400);
    }
    if (error instanceof AiConfigurationError) {
      if (process.env.ASR_SERVICE_URL?.trim()) {
        return jsonError("语音转写服务尚未配置或不可用，请检查服务器端语音配置。", 503);
      }
      return jsonError("语音输入尚未配置，请先设置服务器端 OPENAI_API_KEY。", 503);
    }
    if (error instanceof AiTimeoutError) {
      return jsonError("语音转写超时，请稍后重试。", 504);
    }
    if (error instanceof AiInvalidResponseError) {
      return jsonError("语音转写返回内容无效，请重新录制。", 502);
    }
    if (error instanceof AiGatewayError) {
      return jsonError("语音转写服务暂时不可用，请稍后重试。", 502);
    }
    return jsonError("语音转写失败，请稍后重试。", 500);
  }
}
