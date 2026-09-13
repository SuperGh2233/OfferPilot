import { describe, expect, it } from "vitest";

import {
  analyzeKnowledgeRecall,
  parseKnowledgeRecallAnalysis,
  type KnowledgeRecallAnalysis,
} from "../lib/ai/knowledge-recall-analysis";
import {
  AiConfigurationError,
  AiGatewayError,
  AiInvalidResponseError,
  AiTimeoutError,
} from "../lib/ai/openai";

const validAnalysis = {
  semanticScore: 75,
  verdict: "mostly_correct",
  summary: "已经说明面向对象和跨平台特性。",
  coveredPoints: [{ index: 0, evidence: "回答提到了面向对象。" }],
  missingPoints: [{ index: 1, guidance: "补充垃圾回收机制。" }],
  misconceptions: [],
  improvedAnswer: "Java 是面向对象、跨平台并具有垃圾回收机制的编程语言。",
} satisfies KnowledgeRecallAnalysis;

const input = {
  questionId: "question-1",
  question: "什么是 Java？",
  answerText: "Java 是面向对象且跨平台的语言。",
  keyPoints: ["Java 是面向对象的语言。", "Java 提供垃圾回收机制。"],
};

describe("knowledge recall AI analysis", () => {
  it("accepts the exact response shape and rejects invalid point indexes", () => {
    expect(parseKnowledgeRecallAnalysis(validAnalysis, 2)).toEqual(validAnalysis);
    expect(() => parseKnowledgeRecallAnalysis({
      ...validAnalysis,
      coveredPoints: [{ index: 2, evidence: "越界" }],
    }, 2)).toThrow(TypeError);
    expect(() => parseKnowledgeRecallAnalysis({ ...validAnalysis, extra: true }, 2)).toThrow(TypeError);
  });

  it("uses the OpenAI-compatible chat endpoint with strict structured output", async () => {
    let request: unknown;
    const analysis = await analyzeKnowledgeRecall(input, {
      env: { OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: "https://example.com/v1", OPENAI_MODEL: "qwen3.7-flash" },
      createCompletion: async (body) => {
        request = body;
        return { choices: [{ message: { content: JSON.stringify(validAnalysis) } }] };
      },
    });

    expect(analysis).toEqual(validAnalysis);
    expect(request).toMatchObject({
      model: "qwen3.7-flash",
      enable_thinking: false,
      response_format: { type: "json_schema", json_schema: { strict: true } },
    });
  });

  it("validates configuration, gateway output and timeout", async () => {
    await expect(analyzeKnowledgeRecall(input, { env: {} })).rejects.toBeInstanceOf(AiConfigurationError);
    await expect(analyzeKnowledgeRecall(input, {
      env: { OPENAI_API_KEY: "test-key" },
      createCompletion: async () => ({ choices: [{ message: { content: "{}" } }] }),
    })).rejects.toBeInstanceOf(AiInvalidResponseError);
    await expect(analyzeKnowledgeRecall(input, {
      env: { OPENAI_API_KEY: "test-key" },
      createCompletion: async () => { throw new Error("gateway down"); },
    })).rejects.toBeInstanceOf(AiGatewayError);
    await expect(analyzeKnowledgeRecall(input, {
      env: { OPENAI_API_KEY: "test-key" },
      timeoutMs: 5,
      createCompletion: (_body, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    })).rejects.toBeInstanceOf(AiTimeoutError);
  });
});
