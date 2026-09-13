import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../app/api/ai/analyze-recall/route";

function request(body: string) {
  return new Request("http://localhost/api/ai/analyze-recall", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/ai/analyze-recall in local demo mode", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_DEMO_MODE", "true");
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects malformed, empty, oversized and unknown inputs", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ questionId: "x", answerText: " " })))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ questionId: "x", answerText: "x".repeat(5_001) })))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ questionId: "missing", answerText: "回答" })))).status).toBe(400);
  });

  it("reports missing private API configuration", async () => {
    const questionId = (await import("../lib/knowledge/catalog")).knowledgeQuestions[0].id;
    const response = await POST(request(JSON.stringify({ questionId, answerText: "我的回答" })));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "AI 复核尚未配置，请先设置服务器端 OPENAI_API_KEY。",
    });
  });
});
