import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedTrainingContext: vi.fn(),
  completeCloudAlgorithmAttempt: vi.fn(),
  importCloudAlgorithms: vi.fn(),
  loadCloudTrainingSnapshot: vi.fn(),
  recordCloudKnowledgeAttempt: vi.fn(),
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
    completeCloudAlgorithmAttempt: mocks.completeCloudAlgorithmAttempt,
    importCloudAlgorithms: mocks.importCloudAlgorithms,
    loadCloudTrainingSnapshot: mocks.loadCloudTrainingSnapshot,
    recordCloudKnowledgeAttempt: mocks.recordCloudKnowledgeAttempt,
    startCloudAlgorithmAttempt: mocks.startCloudAlgorithmAttempt,
    updateCloudProfile: mocks.updateCloudProfile,
  };
});

import { POST as algorithmPost } from "../app/api/training/algorithm/route";
import { POST as knowledgePost } from "../app/api/training/knowledge/route";
import { PUT as profilePut } from "../app/api/training/profile/route";
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
    );
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
