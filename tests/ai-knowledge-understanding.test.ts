import { describe, expect, it } from "vitest";

import {
  explainKnowledge,
  parseKnowledgeUnderstanding,
  type KnowledgeUnderstanding,
} from "../lib/ai/knowledge-understanding";
import {
  AiConfigurationError,
  AiGatewayError,
  AiInvalidResponseError,
  AiTimeoutError,
} from "../lib/ai/openai";

const validExplanation = {
  coreIdea: "扩容就是把数据搬到更大的桶数组里，让后续定位更分散。",
  prerequisites: ["哈希值", "桶"] ,
  analogy: "像把拥挤的储物柜换成更多柜子。",
  steps: [
    { title: "计算位置", detail: "先根据 key 的哈希值找到桶。" },
    { title: "判断是否需要扩容", detail: "元素太多时，避免单个桶过于拥挤。" },
  ],
  example: "有 8 个桶却放入很多元素时，容器会增加桶并重新分配位置。",
  takeaways: ["先定位桶", "拥挤时扩容", "扩容后要重新定位"],
  selfCheck: [{ question: "为什么扩容后不能直接沿用旧位置？", answer: "桶数量变化后，位置计算结果可能变化。" }],
} satisfies KnowledgeUnderstanding;

const input = {
  questionId: "question-1",
  question: "为什么 HashMap 需要扩容？",
  shortAnswer: "元素过多导致冲突增多时扩容。",
  interviewAnswer: "HashMap 会根据负载情况扩容并重新分布元素。",
  keyPoints: ["冲突", "扩容", "重新分布"],
};

describe("knowledge understanding coach", () => {
  it("accepts the compact structured explanation and rejects extra fields", () => {
    expect(parseKnowledgeUnderstanding(validExplanation)).toEqual(validExplanation);
    expect(() => parseKnowledgeUnderstanding({ ...validExplanation, extra: true })).toThrow(TypeError);
    expect(() => parseKnowledgeUnderstanding({ ...validExplanation, steps: [{ title: "", detail: "说明" }] })).toThrow(TypeError);
    expect(() => parseKnowledgeUnderstanding({ ...validExplanation, selfCheck: [] })).toThrow(TypeError);
  });

  it("requests a strict structured explanation without exposing model credentials", async () => {
    let request: unknown;
    const explanation = await explainKnowledge(input, {
      env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "qwen3.7-flash" },
      createCompletion: async (body) => {
        request = body;
        return { choices: [{ message: { content: JSON.stringify(validExplanation) } }] };
      },
    });

    expect(explanation).toEqual(validExplanation);
    expect(request).toMatchObject({
      model: "qwen3.7-flash",
      enable_thinking: false,
      response_format: { type: "json_schema", json_schema: { name: "knowledge_understanding", strict: true } },
    });
    expect(JSON.stringify(request)).not.toContain("test-key");
  });

  it("keeps configuration, gateway, invalid output and timeout failures typed", async () => {
    await expect(explainKnowledge(input, { env: {} })).rejects.toBeInstanceOf(AiConfigurationError);
    await expect(explainKnowledge(input, {
      env: { OPENAI_API_KEY: "test-key" },
      createCompletion: async () => ({ choices: [{ message: { content: "{}" } }] }),
    })).rejects.toBeInstanceOf(AiInvalidResponseError);
    await expect(explainKnowledge(input, {
      env: { OPENAI_API_KEY: "test-key" },
      createCompletion: async () => { throw new Error("gateway down"); },
    })).rejects.toBeInstanceOf(AiGatewayError);
    await expect(explainKnowledge(input, {
      env: { OPENAI_API_KEY: "test-key" },
      timeoutMs: 5,
      createCompletion: (_body, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    })).rejects.toBeInstanceOf(AiTimeoutError);
  });

  it("rejects an oversized learner question", async () => {
    await expect(explainKnowledge({ ...input, confusionText: "x".repeat(501) }, {
      env: { OPENAI_API_KEY: "test-key" },
    })).rejects.toThrow(RangeError);
  });
});
