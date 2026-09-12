import { NextResponse } from "next/server";

import {
  isAlgorithmCodeAnalysis,
  type AlgorithmCodeAnalysis,
} from "../../../../lib/ai/code-analysis";
import { getLocalTrainingDatabase } from "../../../../lib/local-database";
import type {
  AlgorithmIndependence,
  AlgorithmMistakeTag,
  AlgorithmResult,
} from "../../../../lib/mastery/algorithm";
import { isLocalDatabaseMode } from "../../../../lib/supabase/env";
import {
  completeCloudAlgorithmAttempt,
  loadCloudTrainingSnapshot,
  startCloudAlgorithmAttempt,
} from "../../../../lib/supabase/training";
import {
  authenticatedTrainingContext,
  requestObject,
  requestUuid,
  trainingError,
  unauthorized,
} from "../_shared";

const results: readonly AlgorithmResult[] = ["first_ac", "wa_then_ac", "failed"];
const independence: readonly AlgorithmIndependence[] = [
  "independent",
  "small_hint",
  "solution_hint",
  "full_solution",
];
const mistakeTags: readonly AlgorithmMistakeTag[] = [
  "no_idea",
  "wrong_idea",
  "boundary",
  "pointer",
  "state",
  "java_syntax",
  "java_api",
  "data_structure",
  "complexity",
  "careless",
];

function nonEmpty(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(label + " 不能为空。");
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const localMode = isLocalDatabaseMode();
    const context = localMode ? null : await authenticatedTrainingContext();
    if (!localMode && !context) return unauthorized();
    const body = await requestObject(request);
    const action = body.action;
    const problemId = nonEmpty(body.problemId, "problemId");

    if (action === "start") {
      const attempt = localMode
        ? getLocalTrainingDatabase().startAlgorithm(problemId)
        : await startCloudAlgorithmAttempt(context!.client, context!.userId, problemId);
      const snapshot = localMode
        ? getLocalTrainingDatabase().loadSnapshot()
        : await loadCloudTrainingSnapshot(context!.client, context!.userId);
      return NextResponse.json({ attempt, snapshot });
    }
    if (action !== "complete") {
      throw new RangeError("action 必须是 start 或 complete。");
    }

    const attemptId = requestUuid(body.attemptId, "attemptId");
    const finishedAt = nonEmpty(body.finishedAt, "finishedAt");
    const finishedTime = new Date(finishedAt).getTime();
    if (!Number.isFinite(finishedTime) || finishedTime > Date.now() + 60_000) {
      throw new RangeError("finishedAt 必须是有效且不晚于当前时间的日期。");
    }
    if (
      typeof body.result !== "string" ||
      !results.includes(body.result as AlgorithmResult)
    ) {
      throw new RangeError("result 无效。");
    }
    if (
      typeof body.independence !== "string" ||
      !independence.includes(body.independence as AlgorithmIndependence)
    ) {
      throw new RangeError("independence 无效。");
    }
    if (
      !Number.isSafeInteger(body.waCount) ||
      Number(body.waCount) < 0 ||
      Number(body.waCount) > 3
    ) {
      throw new RangeError("waCount 必须是 0、1、2 或 3。");
    }
    if (
      !Array.isArray(body.mistakeTags) ||
      body.mistakeTags.some(
        (tag) =>
          typeof tag !== "string" ||
          !mistakeTags.includes(tag as AlgorithmMistakeTag),
      )
    ) {
      throw new RangeError("mistakeTags 无效。");
    }
    const code = body.code === null || body.code === undefined
      ? null
      : nonEmpty(body.code, "code");
    if (code && code.length > 20_000) {
      throw new RangeError("code 不能超过 20000 个字符。");
    }
    let aiAnalysis: AlgorithmCodeAnalysis | null = null;
    if (body.aiAnalysis !== null && body.aiAnalysis !== undefined) {
      if (!isAlgorithmCodeAnalysis(body.aiAnalysis)) {
        throw new RangeError("aiAnalysis 无效。");
      }
      aiAnalysis = body.aiAnalysis;
    }

    const input = {
        attemptId,
        problemId,
        finishedAt,
        result: body.result as AlgorithmResult,
        independence: body.independence as AlgorithmIndependence,
        waCount: Number(body.waCount),
        mistakeTags: body.mistakeTags as AlgorithmMistakeTag[],
        code,
        aiAnalysis,
      };
    const completion = localMode
      ? getLocalTrainingDatabase().completeAlgorithm(input)
      : await completeCloudAlgorithmAttempt(context!.client, context!.userId, input);
    const snapshot = localMode
      ? getLocalTrainingDatabase().loadSnapshot()
      : await loadCloudTrainingSnapshot(context!.client, context!.userId);
    return NextResponse.json({ completion, snapshot });
  } catch (error) {
    return trainingError(error);
  }
}
