import { describe, expect, it } from "vitest";

import {
  AiConfigurationError,
  AiGatewayError,
  AiInvalidResponseError,
  AiTimeoutError,
} from "../lib/ai/openai";
import {
  extractTranscript,
  getOpenAiTranscriptionConfig,
  MAX_AUDIO_BASE64_LENGTH,
  normalizeTranscriptionMimeType,
  transcribeAudio,
  type TranscriptionFetch,
} from "../lib/ai/transcription";

const env = {
  OPENAI_API_KEY: "test-key",
  OPENAI_BASE_URL: "https://example.test/compatible-mode/v1",
};
/** 16 个字符，长度是 4 的倍数，符合 base64 形状校验。 */
const audioBase64 = Buffer.from("fake-audio").toString("base64");

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function transcriptPayload(content: unknown) {
  return { choices: [{ message: { content } }] };
}

describe("getOpenAiTranscriptionConfig", () => {
  it("requires a server-side API key", () => {
    expect(() => getOpenAiTranscriptionConfig({})).toThrow(AiConfigurationError);
    expect(() => getOpenAiTranscriptionConfig({ OPENAI_API_KEY: "   " })).toThrow(AiConfigurationError);
  });

  it("defaults to qwen3-asr-flash and normalizes the base url", () => {
    expect(getOpenAiTranscriptionConfig(env)).toEqual({
      apiKey: "test-key",
      endpoint: "https://example.test/compatible-mode/v1/chat/completions",
      model: "qwen3-asr-flash",
    });
    expect(
      getOpenAiTranscriptionConfig({ ...env, OPENAI_BASE_URL: "https://example.test/v1///" }).endpoint,
    ).toBe("https://example.test/v1/chat/completions");
  });

  it("allows overriding the transcription model", () => {
    expect(getOpenAiTranscriptionConfig({ ...env, OPENAI_TRANSCRIBE_MODEL: "fun-asr" }).model).toBe("fun-asr");
  });
});

describe("normalizeTranscriptionMimeType", () => {
  it("accepts known audio types case-insensitively and rejects the rest", () => {
    expect(normalizeTranscriptionMimeType(" Audio/WAV ")).toBe("audio/wav");
    expect(normalizeTranscriptionMimeType("audio/webm")).toBe("audio/webm");
    expect(normalizeTranscriptionMimeType("text/plain")).toBeNull();
    expect(normalizeTranscriptionMimeType("audio/wav;codecs=opus")).toBeNull();
    expect(normalizeTranscriptionMimeType(undefined)).toBeNull();
  });
});

describe("extractTranscript", () => {
  it("trims the transcript and accepts text blocks", () => {
    expect(extractTranscript(transcriptPayload("  hash 定位桶 "))).toBe("hash 定位桶");
    expect(extractTranscript(transcriptPayload([{ text: "hash" }, { text: "定位桶" }]))).toBe("hash定位桶");
  });

  it("treats silent audio as an empty transcript instead of a failure", () => {
    expect(extractTranscript(transcriptPayload("   "))).toBe("");
  });

  it("rejects malformed responses", () => {
    expect(() => extractTranscript(null)).toThrow(AiInvalidResponseError);
    expect(() => extractTranscript({})).toThrow(AiInvalidResponseError);
    expect(() => extractTranscript({ choices: [] })).toThrow(AiInvalidResponseError);
    expect(() => extractTranscript({ choices: [{ message: {} }] })).toThrow(AiInvalidResponseError);
    expect(() => extractTranscript(transcriptPayload(42))).toThrow(AiInvalidResponseError);
    expect(() => extractTranscript(transcriptPayload([{ text: "ok" }, { wrong: "x" }])))
      .toThrow(AiInvalidResponseError);
    expect(() => extractTranscript(transcriptPayload("x".repeat(2_001)))).toThrow(AiInvalidResponseError);
  });
});

describe("transcribeAudio", () => {
  it("posts an OpenAI-compatible input_audio request", async () => {
    const captured: { url?: string; init?: Parameters<TranscriptionFetch>[1] } = {};
    const fetchImpl: TranscriptionFetch = async (url, init) => {
      captured.url = url;
      captured.init = init;
      return jsonResponse(transcriptPayload("hash 定位桶"));
    };

    const result = await transcribeAudio({ audioBase64, mimeType: "audio/wav" }, { env, fetchImpl });

    expect(result).toEqual({ text: "hash 定位桶" });
    expect(captured.url).toBe("https://example.test/compatible-mode/v1/chat/completions");
    expect(captured.init?.method).toBe("POST");
    expect(captured.init?.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(captured.init?.body ?? "{}");
    expect(body.model).toBe("qwen3-asr-flash");
    expect(body.stream).toBe(false);
    expect(body.asr_options).toEqual({ enable_itn: false });
    expect(body.messages[0].content[0]).toEqual({
      type: "input_audio",
      input_audio: { data: `data:audio/wav;base64,${audioBase64}` },
    });
  });

  it("rejects invalid input before calling the provider", async () => {
    let called = false;
    const fetchImpl: TranscriptionFetch = async () => {
      called = true;
      return jsonResponse(transcriptPayload("ok"));
    };
    const cases = [
      { audioBase64: "", mimeType: "audio/wav" },
      { audioBase64: "not base64!", mimeType: "audio/wav" },
      { audioBase64: audioBase64.slice(0, 3), mimeType: "audio/wav" },
      { audioBase64: "A".repeat(MAX_AUDIO_BASE64_LENGTH + 4), mimeType: "audio/wav" },
      { audioBase64, mimeType: "text/plain" },
    ];

    for (const input of cases) {
      await expect(transcribeAudio(input, { env, fetchImpl })).rejects.toBeInstanceOf(RangeError);
    }
    expect(called).toBe(false);
  });

  it("maps a non-2xx response to a gateway error", async () => {
    const fetchImpl: TranscriptionFetch = async () => jsonResponse({ error: "boom" }, 500);
    await expect(transcribeAudio({ audioBase64, mimeType: "audio/wav" }, { env, fetchImpl }))
      .rejects.toBeInstanceOf(AiGatewayError);
  });

  it("maps an unparsable body to an invalid response", async () => {
    const fetchImpl: TranscriptionFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("not json");
      },
    });
    await expect(transcribeAudio({ audioBase64, mimeType: "audio/wav" }, { env, fetchImpl }))
      .rejects.toBeInstanceOf(AiInvalidResponseError);
  });

  it("maps a network failure to a gateway error", async () => {
    const fetchImpl: TranscriptionFetch = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(transcribeAudio({ audioBase64, mimeType: "audio/wav" }, { env, fetchImpl }))
      .rejects.toBeInstanceOf(AiGatewayError);
  });

  it("aborts a slow provider and reports a timeout", async () => {
    const fetchImpl: TranscriptionFetch = (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")));
    });

    await expect(
      transcribeAudio({ audioBase64, mimeType: "audio/wav" }, { env, fetchImpl, timeoutMs: 5 }),
    ).rejects.toBeInstanceOf(AiTimeoutError);
  });

  it("reports a missing key as a configuration error", async () => {
    await expect(
      transcribeAudio({ audioBase64, mimeType: "audio/wav" }, { env: { OPENAI_BASE_URL: env.OPENAI_BASE_URL } }),
    ).rejects.toBeInstanceOf(AiConfigurationError);
  });
});
