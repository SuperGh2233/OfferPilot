import { describe, expect, it } from "vitest";

import {
  buildInterviewPlan,
  buildInterviewReport,
  scoreInterviewAnswer,
  type InterviewQuestion,
  type InterviewQuestionState,
} from "../lib/interview/session";

function question(
  id: string,
  topicId: string,
  overrides: Partial<InterviewQuestion> = {},
): InterviewQuestion {
  return {
    id,
    topicId,
    category: "Java",
    topic: topicId,
    question: `Question ${id}`,
    questionType: "main",
    importance: 4,
    isCore6Weeks: true,
    sourceOrder: Number(id.replace(/\D/g, "")) || 1,
    prerequisiteTopicIds: [],
    topicDepth: 0,
    keyPoints: ["核心结论", "适用边界"],
    keywordAliases: {},
    keyPointWeights: {},
    ...overrides,
  };
}

function state(
  questionId: string,
  mastery: number,
  nextReviewAt: string | null,
): InterviewQuestionState {
  return {
    questionId,
    mastery,
    attemptCount: 1,
    nextReviewAt,
  };
}

describe("Sprint 3 interview planner", () => {
  it("prioritizes overdue and weak learned topics, then unlocked stretch before retention", () => {
    const questions = [
      question("q1", "t1"),
      question("q2", "t2"),
      question("q3", "t3"),
      question("q4", "t4", { prerequisiteTopicIds: ["t1"], topicDepth: 1 }),
    ];
    const states = [
      state("q1", 45, "2026-09-30T00:00:00.000Z"),
      state("q2", 85, "2026-09-20T00:00:00.000Z"),
      state("q3", 80, "2026-09-30T00:00:00.000Z"),
    ];

    const plan = buildInterviewPlan({
      questions,
      states,
      now: Date.parse("2026-09-22T00:00:00.000Z"),
      size: 4,
    });

    expect(plan.map((item) => [item.questionId, item.reason])).toEqual([
      ["q2", "overdue"],
      ["q1", "weakness"],
      ["q4", "stretch"],
      ["q3", "retention"],
    ]);
  });

  it("does not select a locked stretch topic", () => {
    const questions = [
      question("q1", "foundation"),
      question("q2", "advanced", {
        prerequisiteTopicIds: ["foundation"],
        topicDepth: 1,
      }),
    ];
    const plan = buildInterviewPlan({
      questions,
      states: [state("q1", 30, "2026-09-30T00:00:00.000Z")],
      now: Date.parse("2026-09-22T00:00:00.000Z"),
      size: 2,
    });

    expect(plan.map((item) => item.questionId)).toEqual(["q1"]);
  });

  it("uses one question per topic before allowing duplicates", () => {
    const questions = [
      question("q1", "same", { sourceOrder: 1 }),
      question("q2", "same", { sourceOrder: 2 }),
      question("q3", "other", { sourceOrder: 3 }),
    ];
    const plan = buildInterviewPlan({
      questions,
      states: [],
      now: Date.parse("2026-09-22T00:00:00.000Z"),
      size: 3,
    });

    expect(plan.slice(0, 2).map((item) => item.topicId)).toEqual(["same", "other"]);
    expect(plan).toHaveLength(3);
  });

  it("does not mutate question or state inputs", () => {
    const questions = [question("q1", "t1")];
    const states = [state("q1", 30, "2026-09-30T00:00:00.000Z")];
    const beforeQuestions = structuredClone(questions);
    const beforeStates = structuredClone(states);

    buildInterviewPlan({ questions, states, size: 1 });

    expect(questions).toEqual(beforeQuestions);
    expect(states).toEqual(beforeStates);
  });
});

describe("Sprint 3 deterministic interview scoring and report", () => {
  it("scores answers with the existing key-point matcher and treats skip as zero", () => {
    const q = question("q1", "t1", {
      keyPoints: ["HashMap 使用数组和链表/红黑树", "扩容会重新分布桶位置"],
      keywordAliases: {
        "HashMap 使用数组和链表/红黑树": ["数组链表红黑树"],
        "扩容会重新分布桶位置": ["扩容重新分布"],
      },
    });

    const answered = scoreInterviewAnswer(q, "底层是数组链表红黑树，扩容重新分布");
    expect(answered.score).toBe(100);
    expect(answered.skipped).toBe(false);
    expect(answered.missingPoints).toEqual([]);

    const skipped = scoreInterviewAnswer(q, "   ");
    expect(skipped.score).toBe(0);
    expect(skipped.skipped).toBe(true);
    expect(skipped.missingPoints).toHaveLength(2);
  });

  it("builds category/topic report and recommends an unsatisfied prerequisite for a weak answer", () => {
    const foundation = question("q1", "foundation");
    const advanced = question("q2", "advanced", {
      prerequisiteTopicIds: ["foundation"],
      topicDepth: 1,
    });
    const response = scoreInterviewAnswer(advanced, "不知道");

    const report = buildInterviewReport({
      responses: [response],
      dependencyNodes: [
        { topicId: "foundation", prerequisiteTopicIds: [] },
        { topicId: "advanced", prerequisiteTopicIds: ["foundation"] },
      ],
      questions: [foundation, advanced],
      states: [state("q1", 30, "2026-09-30T00:00:00.000Z")],
    });

    expect(report.overallScore).toBe(0);
    expect(report.categories).toEqual([
      { category: "Java", score: 0, answered: 1, total: 1 },
    ]);
    expect(report.weakestTopics[0]).toMatchObject({ topicId: "advanced", score: 0 });
    expect(report.recommendedTopicIds).toEqual(["foundation"]);
    expect(report.missingPoints).toEqual(expect.arrayContaining(["核心结论", "适用边界"]));
  });
});
