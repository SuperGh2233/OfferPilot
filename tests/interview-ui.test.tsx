import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AiInterviewFollowUpPanel } from "../components/interview/ai-follow-up-panel";
import { AiInterviewSummaryCard } from "../components/interview/ai-summary-card";
import { InterviewSimulator } from "../components/interview/interview-simulator";
import { scoreInterviewAnswer } from "../lib/interview/session";

describe("Sprint 3 interview UI", () => {
  it("renders the loading boundary safely before local/cloud knowledge state arrives", () => {
    const html = renderToStaticMarkup(
      <InterviewSimulator
        demoMode
        dependencyNodes={[{ topicId: "topic-1", prerequisiteTopicIds: [] }]}
        questions={[{
          id: "q1",
          topicId: "topic-1",
          category: "Java基础",
          topic: "Java 概述",
          question: "Java 有什么特点？",
          questionType: "main",
          importance: 5,
          isCore6Weeks: true,
          sourceOrder: 1,
          prerequisiteTopicIds: [],
          topicDepth: 0,
          keyPoints: ["跨平台"],
          keywordAliases: {},
          keyPointWeights: {},
        }]}
        topics={[{ id: "topic-1", name: "Java 概述", category: "Java基础" }]}
      />,
    );

    expect(html).toContain("正在读取你的知识图谱与掌握状态");
  });

  it("renders deterministic AI-summary fallback immediately", () => {
    const html = renderToStaticMarkup(
      <AiInterviewSummaryCard
        recommendedTopicNames={["HashMap"]}
        report={{
          overallScore: 60,
          answered: 4,
          skipped: 1,
          categories: [{ category: "Java集合", score: 60, answered: 4, total: 5 }],
          strongestTopics: [{ topicId: "t1", topic: "ArrayList", category: "Java集合", score: 90 }],
          weakestTopics: [{ topicId: "t2", topic: "HashMap", category: "Java集合", score: 30 }],
          missingPoints: ["扩容机制"],
          recommendedTopicIds: ["t2"],
        }}
      />,
    );
    expect(html).toContain("AI 辅助解读（不计分）");
    expect(html).toContain("确定性总结");
    expect(html).toContain("HashMap");
  });

  it("renders the follow-up loading boundary without changing main score", () => {
    const question = {
      id: "q1",
      topicId: "t1",
      category: "Java集合",
      topic: "HashMap",
      question: "HashMap 为什么扩容？",
      questionType: "main" as const,
      importance: 5,
      isCore6Weeks: true,
      sourceOrder: 1,
      prerequisiteTopicIds: [],
      topicDepth: 0,
      keyPoints: ["容量阈值", "重新分配桶位置"],
      keywordAliases: {},
      keyPointWeights: {},
    };
    const response = scoreInterviewAnswer(question, "容量阈值");
    const html = renderToStaticMarkup(
      <AiInterviewFollowUpPanel
        onComplete={() => undefined}
        question={question}
        response={response}
      />,
    );
    expect(response.score).toBeGreaterThan(0);
    expect(html).toContain("面试官追问");
    expect(html).toContain("正在根据你的回答生成一条追问");
  });
});
