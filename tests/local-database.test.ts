import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { algorithmCatalog } from "../lib/algorithm/catalog";
import { createAlgorithmDemoData } from "../lib/algorithm/demo-store";
import { knowledgeQuestions } from "../lib/knowledge/catalog";
import { createKnowledgeDemoData } from "../lib/knowledge/demo-store";
import { LocalTrainingDatabase } from "../lib/local-database";
import { createDemoProfile } from "../lib/profile/demo-store";

describe("local SQLite training database", () => {
  it("imports browser data and keeps idempotent training state across restarts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "offerpilot-sqlite-"));
    const path = join(directory, "offerpilot.sqlite");
    const now = new Date("2026-09-11T08:00:00.000Z");
    const profile = {
      ...createDemoProfile("2026-09-09"),
      displayName: "本地数据库用户",
    };
    let database = new LocalTrainingDatabase(path);

    try {
      expect(database.peekSnapshot(now)).toBeNull();
      const imported = database.importSnapshot({
        profile,
        algorithm: createAlgorithmDemoData(profile.planStartDate, profile.timeZone),
        knowledge: createKnowledgeDemoData(profile.planStartDate, profile.timeZone),
      }, now);
      expect(imported.profile.displayName).toBe("本地数据库用户");
      expect(imported.algorithm.dailyTasks["2026-09-11"]).toHaveLength(2);
      expect(imported.knowledge.dailyTasks["2026-09-11"]).toHaveLength(3);

      const problem = algorithmCatalog[0];
      const started = database.startAlgorithm(problem.id, now);
      const completion = database.completeAlgorithm({
        attemptId: started.id,
        problemId: problem.id,
        finishedAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
        result: "first_ac",
        independence: "independent",
        waCount: 0,
        mistakeTags: [],
      });
      expect(completion.state.mastery).toBeGreaterThan(0);
      expect(database.completeAlgorithm({
        attemptId: started.id,
        problemId: problem.id,
        finishedAt: completion.attempt.finishedAt!,
        result: "first_ac",
        independence: "independent",
        waCount: 0,
        mistakeTags: [],
      })).toEqual(completion);

      database.close();
      database = new LocalTrainingDatabase(path);
      const reopened = database.peekSnapshot(now)!;
      expect(reopened.algorithm.attempts).toHaveLength(1);
      expect(reopened.algorithm.states[problem.id].mastery).toBe(completion.state.mastery);

      const question = knowledgeQuestions.find((candidate) =>
        candidate.questionType === "main" && candidate.isCore6Weeks,
      )!;
      const attemptId = crypto.randomUUID();
      const learned = database.recordKnowledge({
        attemptId,
        mode: "learn",
        questionId: question.id,
        attemptedAt: now.toISOString(),
        selfRating: 4,
      });
      expect(learned.state.mastery).toBe(55);
      expect(database.recordKnowledge({
        attemptId,
        mode: "learn",
        questionId: question.id,
        attemptedAt: now.toISOString(),
        selfRating: 4,
      })).toEqual(learned);
      expect(database.loadSnapshot(now).knowledge.attempts).toHaveLength(1);
    } finally {
      database.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
