import { describe, expect, it } from "vitest";

import source from "../data/knowledge/offerpilot_bagu_full.json";
import core from "../data/knowledge/offerpilot_bagu_core_6weeks.json";
import reviews from "../data/knowledge/answer_review_patches.json";
import { knowledgeQuestions, getKnowledgeQuestion } from "../lib/knowledge/catalog";
import { matchKnowledgeKeyPoints } from "../lib/knowledge/match";
import { applyKnowledgeContentReview, cleanKnowledgeFullAnswer, cleanKnowledgeSummary } from "../lib/knowledge/content-cleaning.mjs";
import type { KnowledgeContentPatch, ReviewableQuestion } from "../lib/knowledge/content-cleaning.mjs";

const byId = (id: string) => {
  const found = source.questions.find((question) => question.id === id);
  expect(found).toBeDefined();
  return found!;
};

const ABSTRACT = "0ae8a158-3d24-5442-b7a7-ecad512dfb45";
const HASHSET = "ca4c85ef-5c67-5cbe-bc06-98812681d67f";
const STREAM = "9aed04e7-7995-52a7-aedc-d6eeaecdcdce";
const JVM = "2bf4f9b0-e426-554e-bf9b-8de0816c2885";

describe("reviewed Knowledge answers", () => {
  it("preserves all original source files, stable IDs and the 120 core questions", () => {
    expect(source.questions).toHaveLength(904);
    expect(knowledgeQuestions).toHaveLength(904);
    expect(core.questions).toHaveLength(120);
    expect(new Set(knowledgeQuestions.map((question) => question.id)).size).toBe(904);
    expect(knowledgeQuestions.map((question) => question.id)).toEqual(source.questions.map((question) => question.id));
    // The review corpus is expanded in batches; never regress to the original 33-item baseline.
    expect(Object.keys(reviews).length).toBeGreaterThanOrEqual(164); // 74 prior baseline + 90 additional reviewed UUIDs
    for (const id of Object.keys(reviews)) expect(byId(id).id).toBe(id);
    expect(byId(ABSTRACT).interview_answer).toContain("has-a"); // original is intentionally preserved
    expect(byId(HASHSET).full_answer).toContain("说一点心里话");
  });

  it("repairs newly reviewed JMM/lock/CAS claims and both previously empty entries", () => {
    const jmm = getKnowledgeQuestion("75a51b43-2c26-5c34-9184-0ccc167f2141")!;
    expect(jmm.shortAnswer).toContain("happens-before");
    expect(jmm.fullAnswer).toContain("不规定每次读写必须物理刷新");
    const hb = getKnowledgeQuestion("250706b7-2192-51b5-bd52-41162fa4ac15")!;
    expect(hb.shortAnswer).toContain("不代表");
    const sync = getKnowledgeQuestion("df611f9a-3bf8-5099-a169-86b02161e7a3")!;
    expect(sync.fullAnswer).toContain("不承诺临界区内所有指令绝不重排");
    const cas = getKnowledgeQuestion("0e917a72-c305-5bd2-ba98-db939183d145")!;
    expect(cas.fullAnswer).toContain("其他 CAS 线程不受该锁约束");
    for (const id of ["d200738f-19c9-5b09-a4bc-a26444160f85", "f86eb3e1-5d1f-52cf-a587-1ab49b8812a9"]) {
      const question = getKnowledgeQuestion(id)!;
      expect(question).toBeDefined();
      expect(question.shortAnswer.trim()).not.toBe("");
      expect(question.keyPoints.length).toBeGreaterThan(0);
    }
    const repairedEmpty = source.questions.filter((question) => question.answer_status === "container_only");
    expect(repairedEmpty).toHaveLength(2);
    for (const original of repairedEmpty) {
      const repaired = getKnowledgeQuestion(original.id)!;
      expect(reviews).toHaveProperty(original.id);
      expect(repaired.shortAnswer.trim()).not.toBe("");
      expect(repaired.interviewAnswer.trim()).not.toBe("");
      expect(repaired.fullAnswer.trim()).not.toBe("");
      expect(repaired.keyPoints.length).toBeGreaterThan(0);
    }
  });

  it("keeps reviewed concurrency/collection facts and scoring points aligned", () => {
    const permit = getKnowledgeQuestion("d95a110f-9e5b-5750-9ddc-07e9373bd8d6")!;
    expect(permit.fullAnswer).toContain("acquire 被中断也无条件 finally release");
    expect(permit.keyPoints.join(" ")).toContain("成功才 finally release");
    const shutdown = getKnowledgeQuestion("87328c55-f0b8-5e30-a121-0bd1f2b5c6ae")!;
    expect(shutdown.fullAnswer).toContain("立即返回");
    const concurrentPut = getKnowledgeQuestion("9457872b-3541-5778-92dd-3a2ab671a2b0")!;
    expect(concurrentPut.fullAnswer).toContain("MOVED");
    expect(concurrentPut.fullAnswer).toContain("CAS 失败");
    expect(concurrentPut.fullAnswer).toContain("重新循环");
    const iterable = getKnowledgeQuestion("55207cf9-5d06-5047-b247-fd036159d949")!;
    expect(iterable.keyPoints).toHaveLength(4);
    const weak = getKnowledgeQuestion("35d9eccb-7408-51cc-ac96-52c6db576e06")!;
    expect(weak.fullAnswer).toContain("弱一致语义");
    const mod = getKnowledgeQuestion("d3786c60-37a2-5b8f-83bd-5d7fc2a0dbd0")!;
    expect(mod.interviewAnswer).toContain("-1%8=-1");
    const contract = getKnowledgeQuestion("b0009db6-4cff-535b-bfe4-b5f789c547a0")!;
    expect(contract.keyPoints).toHaveLength(4);
  });

  it("strips a confirmed promotional afterword, not legitimate technology or link references", () => {
    const original = byId(HASHSET).full_answer;
    const cleaned = cleanKnowledgeFullAnswer(original);
    expect(cleaned).toContain("HashMap 在插入元素时");
    expect(cleaned).not.toContain("公众号");
    expect(cleaned).not.toContain("说一点心里话");
    expect(cleanKnowledgeFullAnswer(cleaned)).toBe(cleaned);
    const legitimate = "查看 PDF 解析的技术文档。\n说一点心里话。\n这是技术说明。";
    expect(cleanKnowledgeFullAnswer(legitimate)).toBe(legitimate);
    const withFooter = "有效知识点。\n2024 年 12 月 30 日第二版优化结束。\n说一点心里话。\n关注公众号获取 PDF";
    expect(cleanKnowledgeFullAnswer(withFooter)).toBe("有效知识点。");
    const redis = byId("38a7dc86-fe52-5bd3-bde2-d95971e50a10").full_answer;
    const mysql = byId("bb99b654-3aee-527a-90ec-ab6a5d5dbbc7").full_answer;
    for (const raw of [redis, mysql]) {
      expect(raw).toContain("公众号");
      const cleaned = cleanKnowledgeFullAnswer(raw);
      expect(cleaned).not.toContain("公众号");
      expect(cleaned).toBe(cleanKnowledgeFullAnswer(cleaned));
    }
  });

  it("repairs only unambiguous mechanical punctuation in summaries", () => {
    expect(cleanKnowledgeSummary("第一步，建表：。SQL 示例。。")).toBe("第一步，建表：SQL 示例。");
    expect(cleanKnowledgeSummary("String . toCharArray (); 代码示例")).toBe("String . toCharArray (); 代码示例");
    for (const question of knowledgeQuestions) {
      expect(question.shortAnswer).not.toContain("：。");
      expect(question.interviewAnswer).not.toContain("：。");
    }
  });

  it("repairs the abstract class/interface contract and uses atomic reviewed key points", () => {
    const question = getKnowledgeQuestion(ABSTRACT)!;
    expect(question.interviewAnswer).toContain("接口不是 has-a");
    expect(question.fullAnswer).toContain("Java 9");
    expect(question.keyPoints).toHaveLength(4);
    expect(question.keyPoints.join(" ")).not.toContain("推荐使用实现 Runnable");
  });

  it("does not conflate HashMap value updates with replacing an existing HashSet element", () => {
    const question = getKnowledgeQuestion(HASHSET)!;
    expect(question.shortAnswer).toContain("返回 false");
    expect(question.fullAnswer).toContain("冲突本身不意味着两个元素相等");
    expect(question.fullAnswer).not.toContain("说一点心里话");
    expect(question.keyPoints.join(" ")).toContain("不会替换");
    const score = (answer: string) => matchKnowledgeKeyPoints({
      answer,
      keyPoints: question.keyPoints,
      keywordAliases: question.keywordAliases,
      keyPointWeights: question.keyPointWeights,
    }).coverageScore;
    expect(score("HashMap")).toBe(0); // a single buzzword cannot earn a whole fact
    expect(score("重复 add 返回 false")).toBeGreaterThan(0);
  });

  it("corrects the Stream package and the JVM bytecode/JIT distinction", () => {
    const stream = getKnowledgeQuestion(STREAM)!;
    for (const text of [stream.shortAnswer, stream.interviewAnswer, stream.fullAnswer, ...stream.keyPoints]) {
      expect(text).not.toContain("java.util.Stream");
    }
    expect(stream.shortAnswer).toContain("java.util.stream.Stream");
    const jvm = getKnowledgeQuestion(JVM)!;
    expect(jvm.shortAnswer).toContain("javac");
    expect(jvm.interviewAnswer).toContain("字节码指令进行解释执行");
    expect(jvm.fullAnswer).not.toContain("公众号");
  });

  it("directly corrects documented factual errors and incomplete core answers", () => {
    const float = getKnowledgeQuestion("b90d09b8-3c0c-5bbd-b579-0c8e6eda0154")!;
    expect(float.shortAnswer).toContain("1 位符号、8 位指数、23 位小数位");
    expect(float.fullAnswer).not.toContain("10 位");
    const threadLocal = getKnowledgeQuestion("a10d2d4a-05ea-5a9f-b1c7-2b51f0b20ed4")!;
    expect(threadLocal.fullAnswer).toContain("key 变成 null 并不自动释放 value");
    const hashMap = getKnowledgeQuestion("722d39a4-0108-5d01-964c-b0dc243da66b")!;
    expect(hashMap.shortAnswer).toContain("至少 64");
    const list = getKnowledgeQuestion("8c4d137d-1979-5493-a7a4-32c5e464247c")!;
    expect(list.interviewAnswer).toContain("O(n)");
    expect(list.keyPoints).toHaveLength(4);
    const boot = getKnowledgeQuestion("b4d27924-0065-5794-aea3-5c095ae3a638")!;
    expect(boot.fullAnswer).toContain("AutoConfiguration.imports");
    expect(boot.fullAnswer).toContain("BeanDefinitionRegistryPostProcessor");
    const mysql = getKnowledgeQuestion("bb99b654-3aee-527a-90ec-ab6a5d5dbbc7")!;
    expect(mysql.fullAnswer).toContain("ROW_NUMBER()");
    expect(mysql.fullAnswer).toContain("RANK()");
    expect(mysql.fullAnswer).not.toContain("整整两个月");
    const redis = getKnowledgeQuestion("437ec4d7-c25e-5514-91b5-3238005d54f8")!;
    expect(redis.shortAnswer).toContain("MULTI");
    expect(redis.fullAnswer).toContain("WATCH：在 MULTI 前");
    const cache = getKnowledgeQuestion("aad69d37-bd32-5f05-9905-cb70c4bda4d8")!;
    expect(cache.fullAnswer).toContain("TTL");
    expect(cache.fullAnswer).not.toContain("扫码");
  });

  it("uses fact-specific recall aliases without awarding points for isolated buzzwords", () => {
    const question = getKnowledgeQuestion("b90d09b8-3c0c-5bbd-b579-0c8e6eda0154")!;
    const score = (answer: string) => matchKnowledgeKeyPoints({
      answer,
      keyPoints: question.keyPoints,
      keywordAliases: question.keywordAliases,
      keyPointWeights: question.keyPointWeights,
    }).coverageScore;
    expect(score("float")).toBe(0);
    expect(score("1位符号8位指数23位尾数")).toBeGreaterThan(0);
    const threadLocal = getKnowledgeQuestion("a10d2d4a-05ea-5a9f-b1c7-2b51f0b20ed4")!;
    const threadScore = matchKnowledgeKeyPoints({
      answer: "弱引用键回收但强引用值不会立即释放",
      keyPoints: threadLocal.keyPoints,
      keywordAliases: threadLocal.keywordAliases,
      keyPointWeights: threadLocal.keyPointWeights,
    }).coverageScore;
    expect(threadScore).toBeGreaterThan(0);
  });

  it("all reviewed IDs have one source, nonempty answers and aligned key-point counts", () => {
    for (const id of Object.keys(reviews)) {
      const question = getKnowledgeQuestion(id)!;
      expect(question.shortAnswer.trim()).not.toBe("");
      expect(question.interviewAnswer.trim()).not.toBe("");
      expect(question.fullAnswer.trim()).not.toBe("");
      expect(question.keyPoints.length).toBeGreaterThan(0);
      expect(Object.keys(question.keyPointWeights)).toHaveLength(question.keyPoints.length);
      expect(question.shortAnswer).not.toContain("公众号");
      expect(question.interviewAnswer).not.toContain("公众号");
      expect(question.fullAnswer).not.toContain("公众号");
    }
  });

  it("uses identical pure review results for runtime display and seed input", () => {
    const catalog = getKnowledgeQuestion(STREAM)!;
    const reviewed = applyKnowledgeContentReview(
      byId(STREAM) as unknown as ReviewableQuestion,
      reviews[STREAM] as unknown as KnowledgeContentPatch,
    );
    expect(reviewed.short_answer).toBe(catalog.shortAnswer);
    expect(reviewed.interview_answer).toBe(catalog.interviewAnswer);
    expect(reviewed.full_answer).toBe(catalog.fullAnswer);
    expect(reviewed.key_points).toEqual(catalog.keyPoints);
    expect(applyKnowledgeContentReview(reviewed, reviews[STREAM] as unknown as KnowledgeContentPatch)).toEqual(reviewed);
  });

  it("does not silently rewrite unrelated answers or alter scoring weights", () => {
    const sourceMetadata = source.questions[0];
    const catalogMetadata = getKnowledgeQuestion(sourceMetadata.id)!;
    expect(catalogMetadata.question).toBe(sourceMetadata.question);
    expect(catalogMetadata.topic).toBe(sourceMetadata.topic);
    expect(catalogMetadata.sourceOrder).toBe(sourceMetadata.source_order);
    for (const question of knowledgeQuestions) {
      expect(Object.keys(question.keyPointWeights)).toHaveLength(question.keyPoints.length);
      question.keyPoints.forEach((_, index) =>
        expect(question.keyPointWeights[String(index)]).toBe(index === 0 ? 20 : 5));
    }
  });
});
