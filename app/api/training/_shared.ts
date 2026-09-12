import { NextResponse } from "next/server";

import { LocalTrainingConflictError } from "../../../lib/local-database";
import { createClient } from "../../../lib/supabase/server";
import { CloudTrainingConflictError } from "../../../lib/supabase/training";

export async function authenticatedTrainingContext() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const userId = data?.claims?.sub;
  return error || typeof userId !== "string" ? null : { client, userId };
}

export function unauthorized() {
  return NextResponse.json({ error: "请先登录后再继续训练。" }, { status: 401 });
}

export function trainingError(error: unknown) {
  if (error instanceof RangeError || error instanceof SyntaxError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (
    error instanceof CloudTrainingConflictError
    || error instanceof LocalTrainingConflictError
  ) {
    return NextResponse.json(
      { error: "训练状态已在其他页面更新，请刷新后重试。" },
      { status: 409 },
    );
  }
  console.error("Training API failed", error);
  return NextResponse.json(
    { error: "训练数据库暂时不可用，请稍后重试。" },
    { status: 500 },
  );
}

export async function requestObject(request: Request) {
  const value: unknown = await request.json();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new RangeError("请求体必须是 JSON 对象。");
  }
  return value as Record<string, unknown>;
}

export function requestUuid(value: unknown, label: string) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new RangeError(label + " 必须是有效 UUID。");
  }
  return value;
}
