"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import type { KnowledgeOverviewQuestion } from "./knowledge-overview";
import type { KnowledgeCatalogTopic } from "@/lib/knowledge/catalog";
import type { KnowledgeDemoData } from "@/lib/knowledge/demo-store";
import {
  KNOWLEDGE_BROWSER_PAGE_SIZE,
  matchesKnowledgeSearch,
  matchesKnowledgeStatus,
  parseKnowledgeBrowserQuery,
} from "@/lib/knowledge/browser";

export function KnowledgeCatalogBrowser({ questions, topics, data, now, pauseStartedAt }: {
  questions: readonly KnowledgeOverviewQuestion[];
  topics: readonly KnowledgeCatalogTopic[];
  data: KnowledgeDemoData | null;
  now: number;
  pauseStartedAt: number | null;
}) {
  const params = useSearchParams();
  const query = parseKnowledgeBrowserQuery(params);
  const categories = [...new Set(topics.map((topic) => topic.category))];
  const category = categories.includes(query.category) ? query.category : "全部";
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  const results = questions.filter((question) => {
    const topic = topicsById.get(question.topicId);
    return (category === "全部" || category === topic?.category)
      && (!query.coreOnly || question.isCore6Weeks)
      && matchesKnowledgeStatus(query.status, data?.states[question.id], now, pauseStartedAt)
      && matchesKnowledgeSearch(query.keyword, question.question, topic?.name ?? "", topic?.category ?? "");
  });
  const pageCount = Math.max(1, Math.ceil(results.length / KNOWLEDGE_BROWSER_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const items = results.slice((page - 1) * KNOWLEDGE_BROWSER_PAGE_SIZE, page * KNOWLEDGE_BROWSER_PAGE_SIZE);
  const waitingForState = data === null && query.status !== "all";

  function navigate(updates: Record<string, string>, changePage = false) {
    // Read the synchronous URL so rapid filter changes cannot merge stale router state.
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!changePage) next.delete("page");
    const suffix = next.toString();
    window.history.pushState(null, "", `/knowledge${suffix ? `?${suffix}` : ""}#catalog`);
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "").trim().slice(0, 200);
    navigate({ q: value });
  }

  const returnTo = `/knowledge${params.toString() ? `?${params.toString()}` : ""}`;
  return (
    <section id="catalog" aria-label="查找八股题目" className="scroll-mt-20 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">查找题目</h2>
      <p className="mt-1 text-sm text-muted-foreground">临时查资料或定位薄弱题；打开题目后，学习与回忆仍由你提交。</p>
      <form onSubmit={search} className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor="knowledge-search">搜索题目、主题或技术缩写</label>
        <input key={query.keyword} id="knowledge-search" name="q" type="search" maxLength={200} defaultValue={query.keyword} placeholder="搜索题目、主题或缩写，如 CHM、Redis 持久化" className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">搜索</button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label>分类 <select aria-label="题目分类" value={category} onChange={(event) => navigate({ category: event.target.value === "全部" ? "" : event.target.value })} className="rounded-lg border bg-background px-2 py-2">
          {["全部", ...categories].map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label>状态 <select aria-label="题目学习状态" value={query.status} disabled={!data} onChange={(event) => navigate({ status: event.target.value === "all" ? "" : event.target.value })} className="rounded-lg border bg-background px-2 py-2">
          <option value="all">全部状态</option><option value="unlearned">尚未学习</option><option value="weak">薄弱（掌握度低于 60）</option><option value="due">到期复习</option>
        </select></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={query.coreOnly} onChange={(event) => navigate({ core: event.target.checked ? "1" : "" })} />仅六周核心题</label>
        <Link href="/knowledge#catalog" className="text-muted-foreground underline">清除筛选</Link>
      </div>
      <p role="status" className="mt-4 text-xs text-muted-foreground">{waitingForState ? "正在同步训练状态…" : `${results.length} 道题 · 第 ${page}/${pageCount} 页`}</p>
      {!waitingForState ? (
        <div className="mt-2 divide-y">
          {items.length === 0 ? <p className="py-6 text-sm text-muted-foreground">没有找到匹配的题目，试试更短的关键词或清除筛选。</p> : items.map((question) => {
            const topic = topicsById.get(question.topicId);
            const state = data?.states[question.id];
            return <Link key={question.id} prefetch={false} className="block rounded-lg px-2 py-3 hover:bg-muted" href={`/knowledge/${question.id}?returnTo=${encodeURIComponent(returnTo)}`}>
              <p className="text-sm font-medium leading-6">{question.question}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{topic?.category} · {topic?.name} · {question.questionType === "follow_up" ? "追问" : "主问题"}{question.isCore6Weeks ? " · 核心题" : ""}{state ? ` · 掌握度 ${Math.round(state.mastery)}%` : ""}</p>
            </Link>;
          })}
        </div>
      ) : null}
      <nav aria-label="题库分页" className="mt-4 flex items-center justify-between gap-3">
        <button type="button" disabled={page <= 1 || waitingForState} onClick={() => navigate({ page: String(page - 1) }, true)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">上一页</button>
        <span className="text-xs text-muted-foreground">每页 {KNOWLEDGE_BROWSER_PAGE_SIZE} 道</span>
        <button type="button" disabled={page >= pageCount || waitingForState} onClick={() => navigate({ page: String(page + 1) }, true)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">下一页</button>
      </nav>
    </section>
  );
}
