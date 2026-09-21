import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedTrainingContext: vi.fn(),
  cancelCloudAlgorithmAttempt: vi.fn(),
  completeCloudAlgorithmAttempt: vi.fn(),
  importCloudAlgorithms: vi.fn(),
  loadCloudTrainingSnapshot: vi.fn(),
  recordCloudKnowledgeAttempt: vi.fn(),
  saveCloudAlgorithmAnalysis: vi.fn(),
  setCloudPlanPaused: vi.fn(),
  startCloudAlgorithmAttempt: vi.fn(),
  updateCloudProfile: vi.fn(),
}));

vi.mock("../app/api/training/_shared", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../app/api/training/_shared")>();
  return {
    ...actual,
    authenticatedTrainingContext: mocks.authenticatedTrainingContext,
  };
});

vi.mock("../lib/supabase/training", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/supabase/training")>();
  return {
    ...actual,
    cancelCloudAlgorithmAttempt: mocks.cancelCloudAlgorithmAttempt,
    completeCloudAlgorithmAttempt: mocks.completeCloudAlgorithmAttempt,
    importCloudAlgorithms: mocks.importCloudAlgorithms,
    loadCloudTrainingSnapshot: mocks.loadCloudTrainingSnapshot,
    recordCloudKnowledgeAttempt: mocks.recordCloudKnowledgeAttempt,
    saveCloudAlgorithmAnalysis: mocks.saveCloudAlgorithmAnalysis,
    setCloudPlanPaused: mocks.setCloudPlanPaused,
    startCloudAlgorithmAttempt: mocks.startCloudAlgorithmAttempt,
    updateCloudProfile: mocks.updateCloudProfile,
  };
});

import { POST as algorithmPost } from "../app/api/training/algorithm/route";
import { POST as knowledgePost } from "../app/api/training/knowledge/route";
import { PATCH as profilePatch, PUT as profilePut } from "../app/api/training/profile/route";
import { GET as snapshotGet } from "../app/api/training/snapshot/route";

const context = { client: {}, userId: "user-1" };
const attemptId = "00000000-0000-4000-8000-000000000001";
const questionId = "00000000-0000-4000-8000-000000000002";

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("cloud training routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedTrainingContext.mockResolvedValue(context);
    mocks.loadCloudTrainingSnapshot.mockResolvedValue({ marker: "snapshot" });
  });

  it("returns JSON 401 from every training route before reading request data", async () => {
    mocks.authenticatedTrainingContext.mockResolvedValue(null);
    const unreadableRequest = new Request("http://localhost/api/training/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const responses = await Promise.all([
      snapshotGet(),
      algorithmPost(unreadableRequest.clone()),
      knowledgePost(unreadableRequest.clone()),
      profilePut(unreadableRequest.clone()),
      profilePatch(unreadableRequest.clone()),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      await expect(response.json()).resolves.toMatchObject({
        error: expect.any(String),
      });
    }
    expect(mocks.loadCloudTrainingSnapshot).not.toHaveBeenCalled();
    expect(mocks.startCloudAlgorithmAttempt).not.toHaveBeenCalled();
    expect(mocks.recordCloudKnowledgeAttempt).not.toHaveBeenCalled();
    expect(mocks.updateCloudProfile).not.toHaveBeenCalled();
  });

  it("pauses a plan only for the authenticated user and rejects malformed state", async () => {
    mocks.setCloudPlanPaused.mockResolvedValue({ pausePeriods: [{ start: "2026-09-20", end: null }] });
    const response = await profilePatch(jsonRequest("http://localhost/api/training/profile", {
      paused: true, userId: "another-user",
    }, "PATCH"));
    expect(response.status).toBe(200);
    expect(mocks.setCloudPlanPaused).toHaveBeenCalledWith(context.client, "user-1", true);
    expect(await response.json()).toMatchObject({ profile: { pausePeriods: [{ end: null }] } });
    const invalid = await profilePatch(jsonRequest("http://localhost/api/training/profile", {
      paused: "yes",
    }, "PATCH"));
    expect(invalid.status).toBe(400);
    expect(mocks.setCloudPlanPaused).toHaveBeenCalledTimes(1);
  });

  it("starts an algorithm attempt using the authenticated user only", async () => {
    mocks.startCloudAlgorithmAttempt.mockResolvedValue({ id: "attempt-1" });
    const response = await algorithmPost(
      jsonRequest("http://localhost/api/training/algorithm", {
        action: "start",
        problemId: "1",
        userId: "attacker-controlled",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.startCloudAlgorithmAttempt).toHaveBeenCalledWith(
      context.client,
      "user-1",
      "1",
      expect.any(Date),
    );
    await expect(response.json()).resolves.toMatchObject({
      mutation: { kind: "algorithm_start", attempt: { id: "attempt-1" }, taskTime: expect.any(String) },
    });
    expect(mocks.loadCloudTrainingSnapshot).not.toHaveBeenCalled();
  });

  it("cancels an algorithm attempt using the authenticated user only", async () => {
    const response = await algorithmPost(
      jsonRequest("http://localhost/api/training/algorithm", {
        action: "cancel",
        attemptId,
        problemId: "1",
        userId: "attacker-controlled",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.cancelCloudAlgorithmAttempt).toHaveBeenCalledWith(
      context.client,
      "user-1",
      { attemptId, problemId: "1" },
    );
    await expect(response.json()).resolves.toEqual({
      mutation: { kind: "algorithm_cancel", attemptId, problemId: "1" },
    });
    expect(mocks.loadCloudTrainingSnapshot).not.toHaveBeenCalled();
  });

  it("imports validated Hot 100 ids using the authenticated user only", async () => {
    mocks.importCloudAlgorithms.mockResolvedValue({
      importedCount: 2,
      skippedCount: 0,
    });
    const response = await algorithmPost(
      jsonRequest("http://localhost/api/training/algorithm", {
        action: "import_completed",
        problemIds: ["1", "49"],
        userId: "attacker-controlled",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.importCloudAlgorithms).toHaveBeenCalledWith(
      context.client,
      "user-1",
      ["1", "49"],
    );
  });

  it("rejects invalid algorithm feedback before persistence", async () => {
    const response = await algorithmPost(
      jsonRequest("http://localhost/api/training/algorithm", {
        action: "complete",
        attemptId,
        problemId: "1",
        finishedAt: new Date().toISOString(),
        result: "first_ac",
        independence: "independent",
        waCount: 4,
        mistakeTags: [],
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.completeCloudAlgorithmAttempt).not.toHaveBeenCalled();
  });

  it("completes an algorithm with a delta response rather than reloading history", async () => {
    const completion = { attempt: { id: attemptId, problemId: "1" }, state: { mastery: 70 } };
    mocks.completeCloudAlgorithmAttempt.mockResolvedValue(completion);
    const response = await algorithmPost(
      jsonRequest("http://localhost/api/training/algorithm", {
        action: "complete", attemptId, problemId: "1",
        finishedAt: new Date().toISOString(), result: "first_ac",
        independence: "independent", waCount: 0, mistakeTags: [],
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mutation: { kind: "algorithm_complete", completion },
    });
    expect(mocks.loadCloudTrainingSnapshot).not.toHaveBeenCalled();
  });

  it("saves validated AI analysis on the authenticated completed attempt", async () => {
    const aiAnalysis = {
      solutionType: "other",
      complexity: { time: "O(n)", space: "O(1)" },
      summary: "遍历并处理输入。",
      mistakes: [],
      weaknessTags: ["java_api"],
      goodPoints: ["代码结构清晰。"],
      minimalChanges: [],
    };
    mocks.saveCloudAlgorithmAnalysis.mockResolvedValue({ id: attemptId });
    const response = await algorithmPost(
      jsonRequest("http://localhost/api/training/algorithm", {
        action: "save_ai_analysis",
        attemptId,
        problemId: "1",
        aiAnalysis,
        userId: "attacker-controlled",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.saveCloudAlgorithmAnalysis).toHaveBeenCalledWith(
      context.client,
      "user-1",
      { attemptId, problemId: "1", aiAnalysis },
    );
    await expect(response.json()).resolves.toMatchObject({ mutation: { kind: "algorithm_analysis" } });
    expect(mocks.loadCloudTrainingSnapshot).not.toHaveBeenCalled();
  });

  it("rejects an invalid Learn rating before persistence", async () => {
    const response = await knowledgePost(
      jsonRequest("http://localhost/api/training/knowledge", {
        attemptId,
        mode: "learn",
        questionId,
        selfRating: 9,
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.recordCloudKnowledgeAttempt).not.toHaveBeenCalled();
  });

  it("passes a validated AI review through to the recall submission", async () => {
    const aiAnalysis = {
      semanticScore: 100,
      verdict: "excellent",
      summary: "覆盖完整",
      coveredPoints: [{ index: 0, evidence: "提到了扩容" }],
      missingPoints: [],
      misconceptions: [],
      improvedAnswer: "更完整的表达",
    };
    mocks.recordCloudKnowledgeAttempt.mockResolvedValue({ attempt: {}, state: {} });

    const response = await knowledgePost(
      jsonRequest("http://localhost/api/training/knowledge", {
        attemptId,
        mode: "recall",
        questionId,
        answerText: "发生 resize",
        aiAnalysis,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.recordCloudKnowledgeAttempt).toHaveBeenCalledWith(
      context.client,
      "user-1",
      expect.objectContaining({ answerText: "发生 resize", aiAnalysis }),
    );
    await expect(response.json()).resolves.toMatchObject({ mutation: { kind: "knowledge_record" } });
    expect(mocks.loadCloudTrainingSnapshot).not.toHaveBeenCalled();
  });

  it("keeps a recall submission without an AI review on the deterministic score", async () => {
    mocks.recordCloudKnowledgeAttempt.mockResolvedValue({ attempt: {}, state: {} });

    const response = await knowledgePost(
      jsonRequest("http://localhost/api/training/knowledge", {
        attemptId,
        mode: "recall",
        questionId,
        answerText: "发生 resize",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.recordCloudKnowledgeAttempt).toHaveBeenCalledWith(
      context.client,
      "user-1",
      expect.objectContaining({ aiAnalysis: null }),
    );
  });

  it("rejects a malformed AI review before persistence", async () => {
    for (const broken of [
      { semanticScore: 120 },
      { semanticScore: 80, verdict: "perfect", summary: "x", coveredPoints: [], missingPoints: [], misconceptions: [], improvedAnswer: "y" },
      "not-an-object",
    ]) {
      const response = await knowledgePost(
        jsonRequest("http://localhost/api/training/knowledge", {
          attemptId,
          mode: "recall",
          questionId,
          answerText: "发生 resize",
          aiAnalysis: broken,
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(mocks.recordCloudKnowledgeAttempt).not.toHaveBeenCalled();
  });

  it("rejects malformed profile fields through the service boundary", async () => {
    mocks.updateCloudProfile.mockRejectedValue(
      new RangeError("Profile fields are invalid"),
    );
    const response = await profilePut(
      jsonRequest(
        "http://localhost/api/training/profile",
        { version: 1, timeZone: "Mars/Olympus" },
        "PUT",
      ),
    );
    expect(response.status).toBe(400);
    expect(mocks.loadCloudTrainingSnapshot).not.toHaveBeenCalled();
  });
});
