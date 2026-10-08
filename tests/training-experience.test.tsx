import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DailyTrainingFocus } from "../components/dashboard/daily-training-focus";
import { AnswerContent } from "../components/knowledge/answer-content";
import { getDailyTrainingFocus } from "../lib/progress/daily-focus";
import type { NextTrainingQueueTask } from "../lib/progress/next-task";
import {
  knowledgeReturnHref,
  matchesKnowledgeSearch,
  matchesKnowledgeStatus,
  parseKnowledgeBrowserQuery,
} from "../lib/knowledge/browser";

const todayKey = "2026-10-08";
const now = Date.parse("2026-10-08T04:00:00Z");
const catalog = ["a", "b", "c"].map((id, order) => ({ id, order }));
function task(id: string, date = todayKey, status: NextTrainingQueueTask["status"] = "pending", taskType = "new", sortOrder = 1) {
  return { id, date, status, taskType, sortOrder };
}
function focus(algorithmTasks: NextTrainingQueueTask[] = [], knowledgeTasks: NextTrainingQueueTask[] = [], pauseStartedAt: number | null = null) {
  return getDailyTrainingFocus({
    todayKey, now, pauseStartedAt, planStartDate: "2026-10-01",
    algorithm: { tasks: algorithmTasks, states: [], catalog },
    knowledge: { tasks: knowledgeTasks, states: [], catalog },
  });
}

describe("Dashboard direct continuation", () => {
  it("chooses today's work across modules before old algorithm debt", () => {
    expect(focus([task("a", "2026-10-07")], [task("b")]).next?.href).toBe("/knowledge/b");
  });
  it("resumes in-progress work within the same priority", () => {
    expect(focus([task("a")], [task("b", todayKey, "in_progress")]).next?.href).toBe("/knowledge/b");
    expect(focus([task("a"), task("b", todayKey, "in_progress", "new", 2)]).next?.href).toBe("/algorithm/b");
  });
  it("uses oldest debt across modules after today's work is done", () => {
    expect(focus([task("a", "2026-10-07")], [task("b", "2026-10-06")]).next?.href).toBe("/knowledge/b");
  });
  it("estimates remaining today only, separating debt and completed work", () => {
    const result = focus([task("a"), task("b", todayKey, "completed"), task("c", "2026-10-07")], [task("a", todayKey, "pending", "review")]);
    expect(result.estimatedMinutes).toBe(30);
    expect(result.remaining).toBe(2);
    expect(result.algorithmCompleted).toBe(1);
    expect(result.dayComplete).toBe(false);
  });
  it("does not present empty or paused days as completed training", () => {
    expect(focus().dayComplete).toBe(false);
    expect(focus([task("a", todayKey, "completed")], [], now - 1000).dayComplete).toBe(false);
    const result = focus([task("a", todayKey, "completed"), task("b", "2026-10-07")]);
    expect(result.dayComplete).toBe(true);
    const html = renderToStaticMarkup(<DailyTrainingFocus focus={result} paused={false} />);
    expect(html).toContain("今日计划已完成");
    expect(html).toContain("仍可继续处理欠账");
    expect(html).toContain('/algorithm/b');
  });
  it("defers reviews that become due during a pause while keeping old due debt", () => {
    const boundary = now - 3600_000;
    const result = getDailyTrainingFocus({
      todayKey, now, pauseStartedAt: boundary, planStartDate: "2026-10-01",
      algorithm: { tasks: [], catalog, states: [{ id: "a", attemptCount: 1, nextReviewAt: new Date(boundary).toISOString() }] },
      knowledge: { tasks: [], catalog, states: [{ id: "b", attemptCount: 1, nextReviewAt: new Date(boundary - 1).toISOString() }] },
    });
    expect(result.next?.href).toBe("/knowledge/b");
    const futurePlan = getDailyTrainingFocus({
      todayKey, now, planStartDate: "2026-10-09",
      algorithm: { tasks: [task("a")], states: [], catalog },
      knowledge: { tasks: [], states: [], catalog },
    });
    expect(futurePlan.remaining).toBe(0);
    expect(futurePlan.dayComplete).toBe(false);
    expect(result.next?.source).toBe("due");
  });
  it("does not inherit generated debt before a reset plan start", () => {
    const result = getDailyTrainingFocus({
      todayKey, now, planStartDate: todayKey,
      algorithm: { tasks: [task("a", "2026-10-07")], states: [], catalog },
      knowledge: { tasks: [task("b")], states: [], catalog },
    });
    expect(result.next?.href).toBe("/knowledge/b");
  });
  it("compares exact due timestamps across modules with different UTC offsets", () => {
    const result = getDailyTrainingFocus({
      todayKey, now, planStartDate: "2026-10-01",
      algorithm: { tasks: [], catalog, states: [{ id: "a", attemptCount: 1, nextReviewAt: "2026-10-08T03:00:00Z" }] },
      knowledge: { tasks: [], catalog, states: [{ id: "b", attemptCount: 1, nextReviewAt: "2026-10-08T09:00:00+08:00" }] },
    });
    expect(result.next?.href).toBe("/knowledge/b");
  });
});

describe("Knowledge metadata browsing", () => {
  it("searches case, punctuation, topic names and multiple words with bounded aliases", () => {
    expect(matchesKnowledgeSearch("ｃｈｍ", "ConcurrentHashMap 如何扩容？", "并发集合", "Java并发")).toBe(true);
    expect(matchesKnowledgeSearch("JMM", "可见性是什么？", "Java 内存模型", "Java并发")).toBe(true);
    expect(matchesKnowledgeSearch("Redis 持久化", "RDB 与 AOF 的区别？", "持久化", "Redis")).toBe(true);
    expect(matchesKnowledgeSearch("Redis JVM", "RDB", "持久化", "Redis")).toBe(false);
  });
  it("validates URL input and keeps core/category/state/page filters", () => {
    expect(parseKnowledgeBrowserQuery(new URLSearchParams("q=Redis&category=Redis&status=due&core=1&page=2"))).toEqual({ keyword: "Redis", category: "Redis", status: "due", coreOnly: true, page: 2 });
    const invalid = parseKnowledgeBrowserQuery(new URLSearchParams({ q: "x".repeat(300), page: "Infinity", status: "unknown" }));
    expect(invalid.keyword).toHaveLength(200);
    expect(invalid.page).toBe(1);
    expect(invalid.status).toBe("all");
    expect(parseKnowledgeBrowserQuery(new URLSearchParams("page=-1")).page).toBe(1);
  });
  it("separates unlearned, weak and due without changing the state", () => {
    const state = { attemptCount: 1, mastery: 45, nextReviewAt: new Date(now - 1).toISOString() };
    const original = { ...state };
    expect(matchesKnowledgeStatus("unlearned", undefined, now)).toBe(true);
    expect(matchesKnowledgeStatus("weak", undefined, now)).toBe(false);
    expect(matchesKnowledgeStatus("weak", state, now)).toBe(true);
    expect(matchesKnowledgeStatus("due", state, now)).toBe(true);
    expect(matchesKnowledgeStatus("due", state, now, now - 1000)).toBe(false);
    expect(state).toEqual(original);
  });
  it("returns only to the local catalog and preserves search context", () => {
    expect(knowledgeReturnHref("/knowledge?q=CHM&core=1&page=2")).toBe("/knowledge?q=CHM&core=1&page=2#catalog");
    for (const unsafe of ["https://example.com/knowledge", "//example.com/knowledge", "javascript:alert(1)", "/algorithm", "\\\\example.com/knowledge"]) {
      expect(knowledgeReturnHref(unsafe)).toBe("/knowledge");
    }
  });
});

describe("Readable reference code", () => {
  it("renders fenced code separately while preserving surrounding content", () => {
    const html = renderToStaticMarkup(<AnswerContent text={'先初始化。\n```java\nint x = 1;\n```\n再执行。'} />);
    expect(html).toContain("先初始化。");
    expect(html).toContain("再执行。");
    expect(html).toContain("<pre");
    expect(html).toContain("int x = 1;");
    expect(html).not.toContain("```");
  });
  it("keeps an unclosed fence as text and escapes HTML", () => {
    const html = renderToStaticMarkup(<AnswerContent text={'<script>alert(1)</script>\n```java\nunfinished'} />);
    expect(html).toContain("```java");
    expect(html).toContain("unfinished");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
