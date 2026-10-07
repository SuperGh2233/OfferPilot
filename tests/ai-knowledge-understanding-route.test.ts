import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../app/api/ai/explain-knowledge/route";

function request(body: string) {
  return new Request("http://localhost/api/ai/explain-knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/ai/explain-knowledge in local demo mode", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_DEMO_MODE", "true");
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects malformed, oversized and unknown requests", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ questionId: 1 })))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ questionId: "x", extra: true })))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ questionId: "x", confusionText: "x".repeat(501) })))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ questionId: "missing" })))).status).toBe(400);
  });

  it("reports missing private AI configuration without exposing reference content", async () => {
    const questionId = (await import("../lib/knowledge/catalog")).knowledgeQuestions[0].id;
    const response = await POST(request(JSON.stringify({ questionId, confusionText: "我不懂" })));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "理解教练尚未配置，请先设置服务器端 OPENAI_API_KEY。",
    });
  });
});
