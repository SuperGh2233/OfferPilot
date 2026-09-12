import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../app/api/ai/analyze-code/route";

function request(body: string) {
  return new Request("http://localhost/api/ai/analyze-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/ai/analyze-code in local demo mode", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_DEMO_MODE", "true");
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects malformed, empty, oversized and unknown inputs", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ problemId: "1", code: "  " })))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ problemId: "1", code: "x".repeat(20_001) })))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ problemId: "missing", code: "class Solution {}" })))).status).toBe(400);
  });

  it("reports missing server configuration without making a real request", async () => {
    const response = await POST(request(JSON.stringify({ problemId: "1", code: "class Solution {}" })));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "AI 分析尚未配置，请先设置服务器端 OPENAI_API_KEY。",
    });
  });

  it("keeps authentication setup failures on a JSON service boundary", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const response = await POST(
      request(JSON.stringify({ problemId: "1", code: "class Solution {}" })),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: "身份验证服务暂时不可用，请稍后重试。",
    });
  });
});
