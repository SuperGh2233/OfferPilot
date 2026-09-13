import { describe, expect, it } from "vitest";

import {
  algorithmCodeAnalysisJsonSchema,
  parseAlgorithmCodeAnalysis,
  type AlgorithmCodeAnalysis,
} from "../lib/ai/code-analysis";
import {
  AiConfigurationError,
  AiGatewayError,
  AiInvalidResponseError,
  AiTimeoutError,
  analyzeJavaCode,
} from "../lib/ai/openai";
import { completeAlgorithmAttempt } from "../lib/algorithm/attempts";

const validAnalysis = {
  solutionType: "hashing",
  complexity: { time: "O(n)", space: "O(n)" },
  summary: "使用哈希表保存已经遍历的元素。",
  mistakes: ["返回值顺序可能写反。"],
  weaknessTags: ["boundary"],
  goodPoints: ["整体思路正确。"],
  minimalChanges: ["交换返回数组中的两个下标。"],
} satisfies AlgorithmCodeAnalysis;

const input = {
  problemId: "1",
  title: "两数之和",
  difficulty: "easy",
  tags: ["数组", "哈希表"],
  code: "class Solution { int[] twoSum(int[] nums, int target) { return null; } }",
};

describe("algorithm code analysis schema", () => {
  it("accepts the exact response shape", () => {
    expect(parseAlgorithmCodeAnalysis(JSON.stringify(validAnalysis))).toEqual(validAnalysis);
  });

  it.each([
    { ...validAnalysis, extra: true },
    { ...validAnalysis, complexity: { time: "O(n)", space: "O(n)", average: "O(n)" } },
    { ...validAnalysis, weaknessTags: ["unknown"] },
    { ...validAnalysis, summary: "" },
    { ...validAnalysis, mistakes: Array.from({ length: 9 }, () => "too many") },
  ])("rejects invalid or extra response fields", (value) => {
    expect(() => parseAlgorithmCodeAnalysis(value)).toThrow(TypeError);
  });

  it("declares a strict closed JSON schema", () => {
    expect(algorithmCodeAnalysisJsonSchema.additionalProperties).toBe(false);
    expect(algorithmCodeAnalysisJsonSchema.properties.complexity.additionalProperties).toBe(false);
    expect(algorithmCodeAnalysisJsonSchema.required).toContain("minimalChanges");
  });
});

describe("OpenAI code analysis service", () => {
  it("sends a chat-compatible strict schema request and parses message content", async () => {
    let request: unknown;
    const analysis = await analyzeJavaCode(input, {
      env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" },
      createCompletion: async (body) => {
        request = body;
        return { choices: [{ message: { content: JSON.stringify(validAnalysis) } }] };
      },
    });

    expect(analysis).toEqual(validAnalysis);
    expect(request).toMatchObject({
      model: "test-model",
      enable_thinking: false,
      response_format: { json_schema: { name: "algorithm_code_analysis", strict: true } },
    });
  });

  it("rejects empty code before calling the gateway", async () => {
    await expect(analyzeJavaCode({ ...input, code: "  " }, {
      env: { OPENAI_API_KEY: "test-key" },
      createCompletion: async () => ({ choices: [{ message: { content: JSON.stringify(validAnalysis) } }] }),
    })).rejects.toThrow(RangeError);
  });

  it("reports missing configuration without a real key", async () => {
    await expect(analyzeJavaCode(input, { env: {} })).rejects.toBeInstanceOf(AiConfigurationError);
  });

  it("distinguishes invalid output and gateway failures", async () => {
    await expect(analyzeJavaCode(input, {
      env: { OPENAI_API_KEY: "test-key" },
      createCompletion: async () => ({ choices: [{ message: { content: null } }] }),
    })).rejects.toBeInstanceOf(AiInvalidResponseError);

    await expect(analyzeJavaCode(input, {
      env: { OPENAI_API_KEY: "test-key" },
      createCompletion: async () => ({ choices: [{ message: { content: "{}" } }] }),
    })).rejects.toBeInstanceOf(AiInvalidResponseError);

    await expect(analyzeJavaCode(input, {
      env: { OPENAI_API_KEY: "test-key" },
      createCompletion: async () => { throw new Error("gateway down"); },
    })).rejects.toBeInstanceOf(AiGatewayError);
  });

  it("aborts and reports a timeout", async () => {
    await expect(analyzeJavaCode(input, {
      env: { OPENAI_API_KEY: "test-key" },
      timeoutMs: 5,
      createCompletion: (_body, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    })).rejects.toBeInstanceOf(AiTimeoutError);
  });
});

describe("AI mastery boundary", () => {
  it("stores AI feedback without changing score, mastery or review", () => {
    const base = {
      id: "attempt-1",
      userId: "user-1",
      problemId: "1",
      difficulty: "easy" as const,
      startedAt: "2026-09-09T00:00:00.000Z",
      finishedAt: "2026-09-09T00:20:00.000Z",
      result: "first_ac" as const,
      independence: "independent" as const,
      waCount: 0,
      mistakeTags: [] as const,
      code: input.code,
    };
    const withoutAi = completeAlgorithmAttempt(base);
    const withAi = completeAlgorithmAttempt({ ...base, aiAnalysis: validAnalysis });

    expect(withAi.state).toEqual(withoutAi.state);
    expect(withAi.attempt.attemptScore).toBe(withoutAi.attempt.attemptScore);
    expect(withAi.attempt.aiAnalysis).toEqual(validAnalysis);
  });
});
