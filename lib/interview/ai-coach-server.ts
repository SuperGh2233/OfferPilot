import OpenAI from "openai";

import { getOpenAiCodeAnalysisConfig } from "../ai/openai";
import type { CoachCompletion } from "./ai-coach";

export function createInterviewCoachCompletion(
  name: "interview_follow_up" | "interview_summary",
): CoachCompletion {
  const config = getOpenAiCodeAnalysisConfig();
  const client = new OpenAI(config);
  return async (prompt, signal) => {
    const body = {
      model: config.model,
      messages: [
        { role: "system" as const, content: prompt.system },
        { role: "user" as const, content: prompt.user },
      ],
      max_completion_tokens: 750,
      enable_thinking: false,
      response_format: {
        type: "json_schema" as const,
        json_schema: {
          name,
          strict: true,
          schema: prompt.schema,
        },
      },
    };
    const result = await client.chat.completions.create(body, { signal });
    const content = result.choices[0]?.message.content;
    if (!content) throw new Error("AI returned empty response");
    return content;
  };
}
