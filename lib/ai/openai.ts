import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import {
  algorithmCodeAnalysisJsonSchema,
  parseAlgorithmCodeAnalysis,
  type AlgorithmCodeAnalysis,
} from "./code-analysis";

const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_TIMEOUT_MS = 20_000;

export class AiConfigurationError extends Error {}
export class AiGatewayError extends Error {}
export class AiInvalidResponseError extends Error {}
export class AiTimeoutError extends Error {}

export type AnalyzeJavaCodeInput = {
  problemId: string;
  title: string;
  difficulty: string;
  tags: readonly string[];
  code: string;
};

type CreateResponse = (
  body: ResponseCreateParamsNonStreaming,
  options: { signal: AbortSignal },
) => Promise<{ output_text: string }>;

export type AnalyzeJavaCodeOptions = {
  createResponse?: CreateResponse;
  env?: OpenAiCodeAnalysisEnv;
  timeoutMs?: number;
};

export type OpenAiCodeAnalysisEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
};

export function getOpenAiCodeAnalysisConfig(env: OpenAiCodeAnalysisEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
}) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiConfigurationError("OPENAI_API_KEY is not configured");
  }

  return {
    apiKey,
    baseURL: env.OPENAI_BASE_URL?.trim() || undefined,
    model: env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

function validateInput(input: AnalyzeJavaCodeInput) {
  if (!input.problemId.trim() || !input.title.trim()) {
    throw new RangeError("problem metadata is required");
  }
  if (!input.code.trim()) throw new RangeError("code must not be empty");
  if (input.code.length > 20_000) throw new RangeError("code must be at most 20000 characters");
}

export async function analyzeJavaCode(
  input: AnalyzeJavaCodeInput,
  options: AnalyzeJavaCodeOptions = {},
): Promise<AlgorithmCodeAnalysis> {
  validateInput(input);
  const config = getOpenAiCodeAnalysisConfig(options.env);
  const client = options.createResponse ? null : new OpenAI(config);
  const createResponse: CreateResponse = options.createResponse ?? (async (body, requestOptions) => {
    if (!client) throw new AiGatewayError("OpenAI client is unavailable");
    return client.responses.create(body, requestOptions);
  });
  const body: ResponseCreateParamsNonStreaming = {
    model: config.model,
    instructions: [
      "你是资深 Java 算法教练。理解用户现有思路，优先给出最小修改，不要默认重写完整解法。",
      "只分析代码正确性、复杂度和薄弱点。weaknessTags 只能从 Schema 枚举中选择。",
      "复盘信息不得评价或修改 mastery。所有文字字段使用简洁中文。",
    ].join("\n"),
    input: [
      `题目 ID：${input.problemId}`,
      `题目：${input.title}`,
      `难度：${input.difficulty}`,
      `标签：${input.tags.join("、") || "无"}`,
      "<java_code>",
      input.code,
      "</java_code>",
    ].join("\n"),
    max_output_tokens: 1_200,
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: "algorithm_code_analysis",
        strict: true,
        schema: algorithmCodeAnalysisJsonSchema,
      },
    },
  };
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let outputText: string;
  try {
    const response = await createResponse(body, { signal: controller.signal });
    outputText = response.output_text;
  } catch (error) {
    if (controller.signal.aborted) throw new AiTimeoutError("OpenAI request timed out", { cause: error });
    if (error instanceof AiGatewayError) throw error;
    throw new AiGatewayError("OpenAI request failed", { cause: error });
  } finally {
    clearTimeout(timer);
  }

  try {
    return parseAlgorithmCodeAnalysis(outputText);
  } catch (error) {
    throw new AiInvalidResponseError("OpenAI returned an invalid code analysis", { cause: error });
  }
}
