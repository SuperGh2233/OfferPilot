import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/ai/test-connection/route";

function request(key?: string, scope = "demo", provider?: string) {
  return new Request("http://localhost/api/ai/test-connection", {
    method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "X-OfferPilot-AI-Key": key, "X-OfferPilot-AI-User": scope } : {}), ...(provider ? { "X-OfferPilot-AI-Provider": provider } : {}) }, body: "{}",
  });
}

describe("AI connection test", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_DEMO_MODE", "true");
    vi.stubEnv("OPENAI_API_KEY", "default-test-key");
    vi.stubEnv("OPENAI_MODEL", "test-model");
    vi.stubEnv("OPENAI_BASE_URL", "https://gateway.example.test/v1");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("tests the selected key and fixed model once without returning credentials", async () => {
    const gateway = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer personal-test-key");
      expect(JSON.parse(String(init?.body))).toMatchObject({ model: "test-model", max_completion_tokens: 8, enable_thinking: false });
      return Response.json({ choices: [{ message: { content: "OK" } }] });
    });
    vi.stubGlobal("fetch", gateway);
    const response = await POST(request("personal-test-key"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(gateway).toHaveBeenCalledTimes(1);
  });

  it("uses the server key when none is supplied and rejects mismatched accounts", async () => {
    const gateway = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer default-test-key");
      return Response.json({ choices: [{ message: { content: "OK" } }] });
    });
    vi.stubGlobal("fetch", gateway);
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request("personal-test-key", "other-user"))).status).toBe(403);
    expect(gateway).toHaveBeenCalledTimes(1);
  });

  it("tests the selected personal provider at its fixed endpoint while keeping the configured model", async () => {
    const gateway = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(_input)).toBe("https://cn-beijing.maas.qianwenaiapi.com/compatible-mode/v1/chat/completions");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer personal-test-key");
      expect(JSON.parse(String(init?.body))).toMatchObject({ model: "test-model", enable_thinking: false });
      return Response.json({ choices: [{ message: { content: "OK" } }] });
    });
    vi.stubGlobal("fetch", gateway);
    expect((await POST(request("personal-test-key", "demo", "qwen-payg"))).status).toBe(200);
    expect(gateway).toHaveBeenCalledTimes(1);
  });

  it.each([[401, "凭据"], [403, "权限"], [404, "接口或模型"], [429, "额度"], [503, "暂时不可用"]])("reports upstream %i safely", async (status, expected) => {
    const gateway = vi.fn(async () => Response.json({ error: { message: "personal-test-key private detail" } }, { status }));
    vi.stubGlobal("fetch", gateway);
    const response = await POST(request("personal-test-key"));
    const text = await response.text();
    expect(response.status).toBe(502);
    expect(text).toContain(expected);
    expect(text).not.toContain("personal-test-key");
    expect(text).not.toContain("private detail");
    expect(gateway).toHaveBeenCalledTimes(1);
  });

  it("reports missing configuration and a bounded timeout", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await POST(request())).status).toBe(503);
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
    const response = await POST(request("personal-test-key"));
    expect(response.status).toBe(504);
  });
});
