import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as followUpPOST } from "../app/api/ai/interview-followup/route";
import { POST as summaryPOST } from "../app/api/ai/interview-summary/route";
import { knowledgeQuestions } from "../lib/knowledge/catalog";

function request(path: string, body: string) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("Sprint 3 AI interview routes in local demo mode", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_DEMO_MODE", "true");
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects malformed/oversized follow-up input and blank history", async () => {
    expect((await followUpPOST(request("/api/ai/interview-followup", "{"))).status).toBe(400);
    expect((await followUpPOST(request("/api/ai/interview-followup", JSON.stringify({
      questionId: "x",
      answerText: "回答",
      priorFollowUps: ["   "],
    })))).status).toBe(400);
    expect((await followUpPOST(request(
      "/api/ai/interview-followup",
      JSON.stringify({ questionId: "x", answerText: "x".repeat(13_000) }),
    ))).status).toBe(413);
  });

  it("returns a deterministic follow-up when AI configuration is absent", async () => {
    const question = knowledgeQuestions.find((item) =>
      item.isCore6Weeks && item.questionType === "main" && item.keyPoints.length > 0,
    );
    expect(question).toBeDefined();

    const response = await followUpPOST(request(
      "/api/ai/interview-followup",
      JSON.stringify({
        questionId: question!.id,
        answerText: "我先说我能想到的部分。",
        priorFollowUps: [],
      }),
    ));
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      followUp: { source: string; question: string };
    };
    expect(payload.followUp.source).toBe("deterministic");
    expect(payload.followUp.question.length).toBeGreaterThan(0);
  });

  it("validates summary input and falls back deterministically without AI config", async () => {
    expect((await summaryPOST(request(
      "/api/ai/interview-summary",
      JSON.stringify({ overallScore: 999 }),
    ))).status).toBe(400);

    const response = await summaryPOST(request(
      "/api/ai/interview-summary",
      JSON.stringify({
        overallScore: 60,
        answered: 4,
        skipped: 1,
        categories: [{ category: "Java集合", score: 60, answered: 4, total: 5 }],
        weakestTopics: [{ topic: "HashMap", category: "Java集合", score: 30 }],
        missingPoints: ["扩容机制"],
        recommendedTopics: ["HashMap"],
      }),
    ));
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      summary: { source: string; nextStep: string };
    };
    expect(payload.summary.source).toBe("deterministic");
    expect(payload.summary.nextStep).toContain("HashMap");
  });
});
