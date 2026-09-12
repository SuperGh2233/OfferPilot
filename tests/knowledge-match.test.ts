import { describe, expect, it } from "vitest";

import {
  matchKnowledgeKeyPoints,
  normalizeChineseText,
} from "../lib/knowledge/match";

describe("normalizeChineseText", () => {
  it("normalizes width, case, whitespace, punctuation and symbols", () => {
    expect(normalizeChineseText(" ＪＶＭ， Java 虚拟机！Resize() ")).toBe(
      "jvmjava虚拟机resize",
    );
  });
});

describe("matchKnowledgeKeyPoints", () => {
  it("uses key point weights instead of matched point count", () => {
    const result = matchKnowledgeKeyPoints({
      answer: "核心结论；普通细节。",
      keyPoints: ["核心结论", "普通细节", "另一个细节"],
      keyPointWeights: { "0": 20, "1": 5, "2": 5 },
    });

    expect(result.coverageScore).toBe(83);
    expect(result.matchedWeight).toBe(25);
    expect(result.totalWeight).toBe(30);
    expect(result.matchedPoints.map(({ point }) => point)).toEqual([
      "核心结论",
      "普通细节",
    ]);
    expect(result.missingPoints.map(({ point }) => point)).toEqual([
      "另一个细节",
    ]);
  });

  it("matches aliases attached to the corresponding key point", () => {
    const result = matchKnowledgeKeyPoints({
      answer: "需要 resize",
      keyPoints: ["扩容", "负载因子"],
      keywordAliases: { 扩容: ["resize", "rehash"] },
    });

    expect(result.coverageScore).toBe(80);
    expect(result.matchedPoints).toEqual([
      { index: 0, point: "扩容", weight: 20, matchedBy: "resize" },
    ]);
  });

  it("attaches an alias to a single unambiguous long key point", () => {
    const result = matchKnowledgeKeyPoints({
      answer: "触发 resize",
      keyPoints: ["扩容时会迁移桶中的数据", "负载因子决定阈值"],
      keywordAliases: { 扩容: ["resize"] },
    });

    expect(result.matchedPoints.map(({ point }) => point)).toEqual([
      "扩容时会迁移桶中的数据",
    ]);
  });

  it("does not let a broad alias match every long point containing its key", () => {
    const result = matchKnowledgeKeyPoints({
      answer: "resize",
      keyPoints: ["HashMap 扩容时会迁移数据", "扩容"],
      keywordAliases: { 扩容: ["resize"] },
    });

    expect(result.matchedPoints.map(({ point }) => point)).toEqual(["扩容"]);
    expect(result.missingPoints.map(({ point }) => point)).toEqual([
      "HashMap 扩容时会迁移数据",
    ]);
  });

  it("falls back to exact normalized key point text when aliases are absent", () => {
    const result = matchKnowledgeKeyPoints({
      answer: "Java 虚拟机是跨平台的基石。",
      keyPoints: ["Java虚拟机是跨平台的基石"],
    });

    expect(result.coverageScore).toBe(100);
    expect(result.matchedPoints[0].matchedBy).toBe("Java虚拟机是跨平台的基石");
  });

  it("uses sorted alias keys as equal-weight fallback points when key points are absent", () => {
    const result = matchKnowledgeKeyPoints({
      answer: "break 和 return",
      keyPoints: [],
      keywordAliases: {
        return: ["返回"],
        break: ["跳出"],
        continue: ["继续"],
      },
    });

    expect(result.source).toBe("keyword_aliases");
    expect(result.coverageScore).toBe(67);
    expect(result.matchedPoints.map(({ point }) => point)).toEqual(["break", "return"]);
    expect(result.missingPoints.map(({ point }) => point)).toEqual(["continue"]);
  });

  it("returns an explicit empty result when no matching facts exist", () => {
    expect(
      matchKnowledgeKeyPoints({ answer: "anything", keyPoints: [] }),
    ).toEqual({
      coverageScore: 0,
      matchedWeight: 0,
      totalWeight: 0,
      matchedPoints: [],
      missingPoints: [],
      source: "none",
    });
  });

  it("rejects invalid weights at the scoring boundary", () => {
    expect(() =>
      matchKnowledgeKeyPoints({
        answer: "结论",
        keyPoints: ["结论"],
        keyPointWeights: { "0": 0 },
      }),
    ).toThrow(/greater than 0/);
  });
});
