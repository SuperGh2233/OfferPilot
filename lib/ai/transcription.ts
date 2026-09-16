import {
  AiConfigurationError,
  AiGatewayError,
  AiInvalidResponseError,
  AiTimeoutError,
} from "./openai";

/**
 * 语音转写（八股 Recall 语音输入）。
 *
 * 走百炼 OpenAI 兼容的 /chat/completions，用 qwen3-asr-flash 识别音频。
 * 刻意不使用 OpenAI SDK：音频输入使用 SDK 类型里不存在的 input_audio 内容块，
 * 直接用 fetch 可以避免类型断言，也便于注入桩函数做单测。
 *
 * 密钥只从服务端环境变量读取，不进入浏览器。
 */

const DEFAULT_MODEL = "qwen3-asr-flash";
const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
/** 非实时识别通常在数秒内返回；留出余量但不超过常见 Serverless 时限。 */
const DEFAULT_TIMEOUT_MS = 30_000;
/**
 * 上传上限。Vercel Serverless 请求体约 4.5MB，base64 会放大约 1/3，
 * 因此把上限压在 4,000,000 字符（原始音频约 3MB，16kHz 单声道约 95 秒）。
 */
export const MAX_AUDIO_BASE64_LENGTH = 4_000_000;
export const MAX_TRANSCRIPT_LENGTH = 2_000;

export const TRANSCRIPTION_MIME_TYPES = [
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/opus",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
] as const;

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export type TranscribeAudioInput = {
  /** 不含 `data:` 前缀的 base64 音频数据。 */
  audioBase64: string;
  mimeType: string;
};

export type OpenAiTranscriptionEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_TRANSCRIBE_MODEL?: string;
};

export type TranscribeAudioResult = {
  /** 转写文本，已去除首尾空白；识别不到语音时为空字符串。 */
  text: string;
};

export type TranscriptionFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export type TranscribeAudioOptions = {
  fetchImpl?: TranscriptionFetch;
  env?: OpenAiTranscriptionEnv;
  timeoutMs?: number;
};

export function getOpenAiTranscriptionConfig(env: OpenAiTranscriptionEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_TRANSCRIBE_MODEL: process.env.OPENAI_TRANSCRIBE_MODEL,
}) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiConfigurationError("OPENAI_API_KEY is not configured");
  }

  const baseURL = env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL;
  return {
    apiKey,
    endpoint: `${baseURL.replace(/\/+$/, "")}/chat/completions`,
    model: env.OPENAI_TRANSCRIBE_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export function normalizeTranscriptionMimeType(value: unknown) {
  if (typeof value !== "string") return null;
  const mimeType = value.trim().toLowerCase();
  return TRANSCRIPTION_MIME_TYPES.includes(mimeType as (typeof TRANSCRIPTION_MIME_TYPES)[number])
    ? mimeType
    : null;
}

function validateInput(input: TranscribeAudioInput) {
  const mimeType = normalizeTranscriptionMimeType(input.mimeType);
  if (!mimeType) throw new RangeError("mimeType must be a supported audio type");

  const audioBase64 = typeof input.audioBase64 === "string" ? input.audioBase64.trim() : "";
  if (!audioBase64) throw new RangeError("audioBase64 must not be empty");
  if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
    throw new RangeError(`audioBase64 must be at most ${MAX_AUDIO_BASE64_LENGTH} characters`);
  }
  if (audioBase64.length % 4 !== 0 || !BASE64_PATTERN.test(audioBase64)) {
    throw new RangeError("audioBase64 must be valid base64");
  }

  return { mimeType, audioBase64 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * 严格提取转写文本。
 * 兼容 qwen3-asr-flash 的字符串 content，以及多模态接口可能返回的文本块数组。
 * 识别不到语音时 content 为空字符串，这属于成功但无内容，交由调用方决定提示。
 */
export function extractTranscript(payload: unknown) {
  if (!isRecord(payload)) throw new AiInvalidResponseError("transcription response is not an object");
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new AiInvalidResponseError("transcription response has no choices");
  }
  const first = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) {
    throw new AiInvalidResponseError("transcription response has no message");
  }
  const content = first.message.content;

  let text: string;
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    const parts = content.filter(
      (part): part is { text: string } =>
        isRecord(part) && typeof part.text === "string",
    );
    if (parts.length !== content.length) {
      throw new AiInvalidResponseError("transcription content blocks are invalid");
    }
    text = parts.map((part) => part.text).join("");
  } else {
    throw new AiInvalidResponseError("transcription response content is invalid");
  }

  const trimmed = text.trim();
  if (trimmed.length > MAX_TRANSCRIPT_LENGTH) {
    throw new AiInvalidResponseError("transcript is longer than the server limit");
  }
  return trimmed;
}

export async function transcribeAudio(
  input: TranscribeAudioInput,
  options: TranscribeAudioOptions = {},
): Promise<TranscribeAudioResult> {
  const { mimeType, audioBase64 } = validateInput(input);
  const config = getOpenAiTranscriptionConfig(options.env);
  const fetchImpl: TranscriptionFetch = options.fetchImpl ?? ((url, init) => fetch(url, init));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: { data: `data:${mimeType};base64,${audioBase64}` },
              },
            ],
          },
        ],
        stream: false,
        asr_options: { enable_itn: false },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AiGatewayError(`transcription request failed with status ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new AiInvalidResponseError("transcription response is not valid JSON", { cause: error });
    }

    return { text: extractTranscript(payload) };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AiTimeoutError("transcription request timed out", { cause: error });
    }
    if (
      error instanceof AiConfigurationError
      || error instanceof AiInvalidResponseError
      || error instanceof AiGatewayError
    ) {
      throw error;
    }
    throw new AiGatewayError("transcription request failed", { cause: error });
  } finally {
    clearTimeout(timer);
  }
}
