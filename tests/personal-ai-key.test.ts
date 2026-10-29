import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/ai/openai", async (load) => ({ ...(await load<typeof import("../lib/ai/openai")>()), analyzeJavaCode: vi.fn(async () => ({})) }));
vi.mock("../lib/ai/knowledge-recall-analysis", async (load) => ({ ...(await load<typeof import("../lib/ai/knowledge-recall-analysis")>()), analyzeKnowledgeRecall: vi.fn(async () => ({})) }));
vi.mock("../lib/ai/knowledge-understanding", async (load) => ({ ...(await load<typeof import("../lib/ai/knowledge-understanding")>()), explainKnowledge: vi.fn(async () => ({})) }));
vi.mock("../lib/interview/ai-coach-server", () => ({ createInterviewCoachCompletion: vi.fn(() => async () => "{}") }));

import { POST as code } from "../app/api/ai/analyze-code/route";
import { POST as recall } from "../app/api/ai/analyze-recall/route";
import { POST as explain } from "../app/api/ai/explain-knowledge/route";
import { POST as followup } from "../app/api/ai/interview-followup/route";
import { POST as summary } from "../app/api/ai/interview-summary/route";
import { GET as settings } from "../app/api/ai/settings/route";
import { analyzeJavaCode } from "../lib/ai/openai";
import { analyzeKnowledgeRecall } from "../lib/ai/knowledge-recall-analysis";
import { explainKnowledge } from "../lib/ai/knowledge-understanding";
import { personalAiEnv } from "../lib/ai/request-settings";
import { aiRequestHeaders, personalKeyStorageName, personalProviderStorageName } from "../lib/ai/personal-key-client";
import { PERSONAL_AI_PROVIDER } from "../lib/ai/personal-ai-provider";
import { createInterviewCoachCompletion } from "../lib/interview/ai-coach-server";
import { knowledgeQuestions } from "../lib/knowledge/catalog";

const question = knowledgeQuestions.find((item) => item.keyPoints.length > 0 && item.answerStatus === "available" && Boolean(item.shortAnswer || item.interviewAnswer))!;
const report = { overallScore: 60, answered: 4, skipped: 1, categories: [{ category: "Java集合", score: 60, answered: 4, total: 5 }], weakestTopics: [], missingPoints: [], recommendedTopics: [] };
const routes = [
  { run: code, body: { problemId: "1", code: "class Solution {}" } },
  { run: recall, body: { questionId: question.id, answerText: "测试" } },
  { run: explain, body: { questionId: question.id } },
  { run: followup, body: { questionId: question.id, answerText: "测试" } },
  { run: summary, body: report },
];
function request(body: unknown, user = "demo", provider?: string) {
  return new Request("http://localhost/api/ai/test", { method: "POST", headers: { "Content-Type": "application/json", "X-OfferPilot-AI-Key": "personal-test-key", "X-OfferPilot-AI-User": user, ...(provider ? { "X-OfferPilot-AI-Provider": provider } : {}) }, body: JSON.stringify(body) });
}

describe("personal AI configuration", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("LOCAL_DEMO_MODE", "true");
    vi.stubEnv("OPENAI_API_KEY", "server-test-key"); vi.stubEnv("OPENAI_MODEL", "existing-model"); vi.stubEnv("OPENAI_BASE_URL", "https://gateway.example.test/v1");
    vi.clearAllMocks();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("returns only public settings and preserves the original server fallback", async () => {
    const response = await settings();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ scope: "demo", model: "existing-model", defaultConfigured: true });
    expect(personalAiEnv(new Request("http://localhost"), "demo")).toEqual({});
  });

  it("passes personal keys to every AI path without changing model or gateway", async () => {
    for (const route of routes) expect((await route.run(request(route.body))).status).toBe(200);
    const env = { OPENAI_API_KEY: "personal-test-key", OPENAI_MODEL: "existing-model", OPENAI_BASE_URL: "https://gateway.example.test/v1" };
    expect(vi.mocked(analyzeJavaCode).mock.calls[0][1]).toEqual({ env });
    expect(vi.mocked(analyzeKnowledgeRecall).mock.calls[0][1]).toEqual({ env });
    expect(vi.mocked(explainKnowledge).mock.calls[0][1]).toEqual({ env });
    expect(vi.mocked(createInterviewCoachCompletion).mock.calls).toEqual([["interview_follow_up", env], ["interview_summary", env]]);
  });

  it("routes only opted-in personal keys through the fixed Qwen pay-as-you-go gateway", async () => {
    for (const route of routes) expect((await route.run(request(route.body, "demo", PERSONAL_AI_PROVIDER.qwenPayg))).status).toBe(200);
    const env = { OPENAI_API_KEY: "personal-test-key", OPENAI_MODEL: "existing-model", OPENAI_BASE_URL: "https://cn-beijing.maas.qianwenaiapi.com/compatible-mode/v1" };
    expect(vi.mocked(analyzeJavaCode).mock.calls[0][1]).toEqual({ env });
    expect(vi.mocked(analyzeKnowledgeRecall).mock.calls[0][1]).toEqual({ env });
    expect(vi.mocked(explainKnowledge).mock.calls[0][1]).toEqual({ env });
    expect(vi.mocked(createInterviewCoachCompletion).mock.calls).toEqual([ ["interview_follow_up", env], ["interview_summary", env] ]);
  });

  it("rejects arbitrary provider IDs before invoking any AI path", async () => {
    for (const route of routes) expect((await route.run(request(route.body, "demo", "https://attacker.example"))).status).toBe(400);
    expect(analyzeJavaCode).not.toHaveBeenCalled();
    expect(analyzeKnowledgeRecall).not.toHaveBeenCalled();
    expect(explainKnowledge).not.toHaveBeenCalled();
    expect(createInterviewCoachCompletion).not.toHaveBeenCalled();
  });

  it("uses existing environment configuration when no personal key is sent", async () => {
    for (const route of routes) {
      const plain = new Request("http://localhost/api/ai/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(route.body) });
      expect((await route.run(plain)).status).toBe(200);
    }
    expect(vi.mocked(analyzeJavaCode).mock.calls[0][1]).toEqual({ env: undefined });
    expect(vi.mocked(analyzeKnowledgeRecall).mock.calls[0][1]).toEqual({ env: undefined });
    expect(vi.mocked(explainKnowledge).mock.calls[0][1]).toEqual({ env: undefined });
    expect(vi.mocked(createInterviewCoachCompletion).mock.calls).toEqual([["interview_follow_up", undefined], ["interview_summary", undefined]]);
  });

  it("rejects account mismatch for every AI path before using a key", async () => {
    for (const route of routes) expect((await route.run(request(route.body, "another-user"))).status).toBe(403);
    expect(analyzeJavaCode).not.toHaveBeenCalled();
    expect(analyzeKnowledgeRecall).not.toHaveBeenCalled();
    expect(explainKnowledge).not.toHaveBeenCalled();
    expect(createInterviewCoachCompletion).not.toHaveBeenCalled();
    expect(personalAiEnv(new Request("http://localhost", { headers: { "X-OfferPilot-AI-Key": "bad key", "X-OfferPilot-AI-User": "demo" } }), "demo").error?.status).toBe(400);
  });

  it("sends only the current account's browser key and fails closed if identity cannot load", async () => {
    const values: Record<string, string> = { [personalKeyStorageName("user-a")]: "key-a", [personalProviderStorageName("user-a")]: PERSONAL_AI_PROVIDER.qwenPayg, [personalProviderStorageName("user-b")]: PERSONAL_AI_PROVIDER.server };
    vi.stubGlobal("window", { localStorage: { getItem: (name: string) => values[name] ?? null } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ scope: "user-a", model: "existing-model", defaultConfigured: true }) })));
    expect(await aiRequestHeaders()).toMatchObject({ "X-OfferPilot-AI-Key": "key-a", "X-OfferPilot-AI-User": "user-a", "X-OfferPilot-AI-Provider": PERSONAL_AI_PROVIDER.qwenPayg });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ scope: "user-b", model: "existing-model", defaultConfigured: true }) })));
    expect(await aiRequestHeaders()).toEqual({ "Content-Type": "application/json" });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    await expect(aiRequestHeaders()).rejects.toThrow("无法读取 AI 设置");
  });
});
