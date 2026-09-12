import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readJson = async (path: string) =>
  JSON.parse(await readFile(resolve(process.cwd(), path), "utf8"));

describe("seed data", () => {
  it("contains a complete official Hot100 snapshot", async () => {
    const data = await readJson("data/algorithm/hot100.json");
    expect(data.snapshot_date).toBe("2026-09-08");
    expect(data.source_url).toBe("https://leetcode.cn/studyplan/top-100-liked/");
    expect(data.problems).toHaveLength(100);
    expect(
      new Set(data.problems.map((item: { leetcode_id: number }) => item.leetcode_id)).size,
    ).toBe(100);
  });

  it("keeps all knowledge relations intact", async () => {
    const [full, core] = await Promise.all([
      readJson("data/knowledge/offerpilot_bagu_full.json"),
      readJson("data/knowledge/offerpilot_bagu_core_6weeks.json"),
    ]);
    const topicIds = new Set(full.topics.map((topic: { id: string }) => topic.id));
    const questionIds = new Set(
      full.questions.map((question: { id: string }) => question.id),
    );
    const coreIds = new Set(core.questions.map((question: { id: string }) => question.id));
    const mainQuestions = full.questions.filter(
      (question: { question_type: string }) => question.question_type === "main",
    );
    const followUpQuestions = full.questions.filter(
      (question: { question_type: string }) =>
        question.question_type === "follow_up",
    );
    const mainQuestionIds = new Set(
      mainQuestions.map((question: { id: string }) => question.id),
    );

    expect(full.topics).toHaveLength(165);
    expect(full.questions).toHaveLength(904);
    expect(mainQuestions).toHaveLength(394);
    expect(followUpQuestions).toHaveLength(510);
    expect(coreIds.size).toBe(120);
    expect(
      full.questions.every((question: { topic_id: string }) =>
        topicIds.has(question.topic_id),
      ),
    ).toBe(true);
    expect(
      followUpQuestions.every((question: { parent_id: string }) =>
        questionIds.has(question.parent_id),
      ),
    ).toBe(true);
    expect(
      followUpQuestions.every((question: { parent_id: string }) =>
        mainQuestionIds.has(question.parent_id),
      ),
    ).toBe(true);
  });
});
