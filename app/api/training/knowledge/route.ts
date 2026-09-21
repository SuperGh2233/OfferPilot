import { NextResponse } from "next/server";

import {
  parseKnowledgeRecallAnalysis,
  type KnowledgeRecallAnalysis,
} from "../../../../lib/ai/knowledge-recall-analysis";
import { getLocalTrainingDatabase } from "../../../../lib/local-database";
import type { KnowledgeSelfRating } from "../../../../lib/mastery/knowledge";
import { isLocalDatabaseMode } from "../../../../lib/supabase/env";
import { recordCloudKnowledgeAttempt } from "../../../../lib/supabase/training";
import {
  authenticatedTrainingContext,
  requestObject,
  requestUuid,
  trainingError,
  unauthorized,
} from "../_shared";

export async function POST(request: Request) {
  try {
    const localMode = isLocalDatabaseMode();
    const context = localMode ? null : await authenticatedTrainingContext();
    if (!localMode && !context) return unauthorized();
    const body = await requestObject(request);
    const attemptId = requestUuid(body.attemptId, "attemptId");
    const questionId = requestUuid(body.questionId, "questionId");
    const attemptedAt = new Date().toISOString();

    if (
      body.mode === "learn" &&
      (typeof body.selfRating !== "number" ||
        ![1, 2, 3, 4].includes(body.selfRating))
    ) {
      throw new RangeError("selfRating 必须是 1 到 4。");
    }
    if (
      body.mode === "recall" &&
      (typeof body.answerText !== "string" || body.answerText.length > 20_000)
    ) {
      throw new RangeError("answerText 必须是长度不超过 20000 的字符串。");
    }

    // AI 语义复核结果由客户端提交，这里做严格结构校验后再进入计分链。
    // 只做纯结构校验（不绑定具体题目的关键点数量），越界索引只影响展示，不影响计分。
    let aiAnalysis: KnowledgeRecallAnalysis | null = null;
    if (body.mode === "recall" && body.aiAnalysis !== undefined && body.aiAnalysis !== null) {
      try {
        aiAnalysis = parseKnowledgeRecallAnalysis(body.aiAnalysis, Number.MAX_SAFE_INTEGER);
      } catch {
        throw new RangeError("aiAnalysis 结构无效。");
      }
    }

    const input = body.mode === "learn"
      ? {
          attemptId,
          mode: "learn" as const,
          questionId,
          attemptedAt,
          selfRating: body.selfRating as KnowledgeSelfRating,
        }
      : body.mode === "recall"
        ? {
            attemptId,
            mode: "recall" as const,
            questionId,
            attemptedAt,
            answerText: body.answerText as string,
            aiAnalysis,
          }
        : null;
    if (!input) throw new RangeError("mode 必须是 learn 或 recall。");
    const result = localMode
      ? getLocalTrainingDatabase().recordKnowledge(input)
      : await recordCloudKnowledgeAttempt(context!.client, context!.userId, input);
    return NextResponse.json({ mutation: { kind: "knowledge_record", result } });
  } catch (error) {
    return trainingError(error);
  }
}
