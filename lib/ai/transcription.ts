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
/** 百炼回退仍保留余量，但不让一次请求无限占住 Serverless。 */
const DEFAULT_TIMEOUT_MS = 30_000;
/** 独立 ASR 服务应在本地网络内快速返回；超时后交给百炼回退。 */
const DEFAULT_FUNASR_TIMEOUT_MS = 15_000;
/**
 * 上传上限。浏览器统一上传 16kHz 单声道 WAV，30 秒约 960KB 原始音频；
 * 2,000,000 个 base64 字符仍留有容器和请求头余量，同时避免长录音放大延迟。
 */
export const MAX_AUDIO_BASE64_LENGTH = 2_000_000;
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

export type TranscriptionEnv = OpenAiTranscriptionEnv & {
  /** 服务端专用；不要改成 NEXT_PUBLIC_。 */
  ASR_SERVICE_URL?: string;
  ASR_SERVICE_TOKEN?: string;
};

export type TranscribeAudioResult = {
  /** 转写文本，已去除首尾空白；识别不到语音时为空字符串。 */
  text: string;
};

export type TranscriptionProviderResult = TranscribeAudioResult & {
  provider: "funasr" | "qwen";
  fallback: boolean;
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

export type FunAsrFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: Blob;
    signal: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export type TranscribeAudioOptions = {
  fetchImpl?: TranscriptionFetch;
  env?: OpenAiTranscriptionEnv;
  timeoutMs?: number;
};

export type FunAsrOptions = {
  fetchImpl?: FunAsrFetch;
  env?: TranscriptionEnv;
  timeoutMs?: number;
};

export type TranscribeWithFallbackOptions = {
  fetchImpl?: TranscriptionFetch;
  funAsrFetchImpl?: FunAsrFetch;
  env?: TranscriptionEnv;
  timeoutMs?: number;
  funAsrTimeoutMs?: number;
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

export function getFunAsrTranscriptionConfig(env: TranscriptionEnv = {
  ASR_SERVICE_URL: process.env.ASR_SERVICE_URL,
  ASR_SERVICE_TOKEN: process.env.ASR_SERVICE_TOKEN,
}) {
  const rawURL = env.ASR_SERVICE_URL?.trim();
  if (!rawURL) return null;

  let baseURL: URL;
  try {
    baseURL = new URL(rawURL);
  } catch (error) {
    throw new AiConfigurationError("ASR_SERVICE_URL is not a valid URL", { cause: error });
  }
  if (baseURL.protocol !== "http:" && baseURL.protocol !== "https:") {
    throw new AiConfigurationError("ASR_SERVICE_URL must use http or https");
  }

  return {
    endpoint: `${rawURL.replace(/\/+$/, "")}/transcribe`,
    token: env.ASR_SERVICE_TOKEN?.trim() || "",
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

function decodeBase64(audioBase64: string) {
  const bytes = Buffer.from(audioBase64, "base64");
  if (bytes.length === 0) throw new RangeError("audioBase64 decoded to empty audio");
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
    type: "audio/wav",
  });
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

/** FunASR 服务的最小响应契约；额外字段由服务端忽略。 */
export function extractFunAsrTranscript(payload: unknown) {
  if (!isRecord(payload) || typeof payload.text !== "string") {
    throw new AiInvalidResponseError("FunASR response has no text");
  }
  const text = payload.text.trim();
  if (text.length > MAX_TRANSCRIPT_LENGTH) {
    throw new AiInvalidResponseError("transcript is longer than the server limit");
  }
  return text;
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

export async function transcribeWithFunAsr(
  input: TranscribeAudioInput,
  options: FunAsrOptions = {},
): Promise<TranscribeAudioResult> {
  const { mimeType, audioBase64 } = validateInput(input);
  if (mimeType !== "audio/wav" && mimeType !== "audio/x-wav") {
    throw new RangeError("FunASR requires a WAV audio input");
  }
  const config = getFunAsrTranscriptionConfig(options.env);
  if (!config) throw new AiConfigurationError("ASR_SERVICE_URL is not configured");
  const fetchImpl: FunAsrFetch = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_FUNASR_TIMEOUT_MS,
  );

  try {
    const headers: Record<string, string> = { "Content-Type": "audio/wav" };
    if (config.token) headers.Authorization = `Bearer ${config.token}`;
    const response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers,
      body: decodeBase64(audioBase64),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AiGatewayError(`FunASR request failed with status ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new AiInvalidResponseError("FunASR response is not valid JSON", { cause: error });
    }
    return { text: extractFunAsrTranscript(payload) };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AiTimeoutError("FunASR request timed out", { cause: error });
    }
    if (
      error instanceof AiConfigurationError
      || error instanceof AiInvalidResponseError
      || error instanceof AiGatewayError
    ) {
      throw error;
    }
    throw new AiGatewayError("FunASR request failed", { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

/** 优先使用独立 FunASR；它故障时才调用原有百炼接口。 */
export async function transcribeAudioWithFallback(
  input: TranscribeAudioInput,
  options: TranscribeWithFallbackOptions = {},
): Promise<TranscriptionProviderResult> {
  validateInput(input);
  const env: TranscriptionEnv = options.env ?? {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_TRANSCRIBE_MODEL: process.env.OPENAI_TRANSCRIBE_MODEL,
    ASR_SERVICE_URL: process.env.ASR_SERVICE_URL,
    ASR_SERVICE_TOKEN: process.env.ASR_SERVICE_TOKEN,
  };
  const hasFunAsr = Boolean(env.ASR_SERVICE_URL?.trim());
  let funAsrError: unknown = null;

  if (hasFunAsr) {
    try {
      const result = await transcribeWithFunAsr(input, {
        env,
        fetchImpl: options.funAsrFetchImpl,
        timeoutMs: options.funAsrTimeoutMs,
      });
      return { ...result, provider: "funasr", fallback: false };
    } catch (error) {
      funAsrError = error;
    }
  }

  try {
    const result = await transcribeAudio(input, {
      env,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
    return { ...result, provider: "qwen", fallback: hasFunAsr && funAsrError !== null };
  } catch (error) {
    // ASR 单独部署时，避免用“缺少百炼 Key”掩盖真正的 ASR 故障。
    if (funAsrError && error instanceof AiConfigurationError) throw funAsrError;
    throw error;
  }
}
