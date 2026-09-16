import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn() }));

vi.mock("../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.getClaims } }),
}));

import { POST } from "../app/api/ai/transcribe/route";

const audioBase64 = Buffer.from("fake-audio").toString("base64");

function request(body: string) {
  return new Request("http://localhost/api/ai/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function payload(body: unknown) {
  return request(JSON.stringify(body));
}

function stubProvider(content: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ choices: [{ message: { content } }] })),
  );
}

describe("POST /api/ai/transcribe in local demo mode", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_DEMO_MODE", "true");
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects malformed, empty, oversized and unsupported inputs", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request("[]"))).status).toBe(400);
    expect((await POST(payload({}))).status).toBe(400);
    expect((await POST(payload({ audioBase64: "   ", mimeType: "audio/wav" }))).status).toBe(400);
    expect((await POST(payload({ audioBase64, mimeType: "text/plain" }))).status).toBe(400);
    expect((await POST(payload({ audioBase64: "A".repeat(4_000_004), mimeType: "audio/wav" }))).status).toBe(400);
  });

  it("reports missing private API configuration", async () => {
    const response = await POST(payload({ audioBase64, mimeType: "audio/wav" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "语音输入尚未配置，请先设置服务器端 OPENAI_API_KEY。",
    });
  });

  it("returns the trimmed transcript", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    stubProvider("  hash 定位桶 ");

    const response = await POST(payload({ audioBase64, mimeType: "audio/wav" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: "hash 定位桶" });
  });

  it("reports silent audio separately from a failure", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    stubProvider("   ");

    const response = await POST(payload({ audioBase64, mimeType: "audio/wav" }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "没有识别到语音内容，请靠近麦克风重试。",
    });
  });
});

describe("POST /api/ai/transcribe anonymous boundary", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_DEMO_MODE", "false");
    vi.stubEnv("LOCAL_DATABASE_MODE", "false");
    mocks.getClaims.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    mocks.getClaims.mockReset();
  });

  it("returns JSON 401 before reading the body or calling the provider", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(payload({ audioBase64, mimeType: "audio/wav" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "请先登录后再使用语音输入。" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
