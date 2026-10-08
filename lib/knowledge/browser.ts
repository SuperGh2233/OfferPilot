import { normalizeChineseText } from "./match";
import { isReviewDue } from "../progress/summary";

export const KNOWLEDGE_BROWSER_STATUSES = ["all", "unlearned", "weak", "due"] as const;
export type KnowledgeBrowserStatus = typeof KNOWLEDGE_BROWSER_STATUSES[number];
export const KNOWLEDGE_BROWSER_PAGE_SIZE = 20;

const SEARCH_ALIASES = [
  ["CHM", "ConcurrentHashMap"],
  ["JMM", "Java内存模型"],
  ["MVCC", "多版本并发控制"],
  ["AQS", "AbstractQueuedSynchronizer", "队列同步器"],
];

export function parseKnowledgeBrowserQuery(params: Pick<URLSearchParams, "get">) {
  const status = params.get("status");
  const page = Number(params.get("page") ?? 1);
  return {
    keyword: (params.get("q") ?? "").trim().slice(0, 200),
    category: params.get("category") ?? "全部",
    status: KNOWLEDGE_BROWSER_STATUSES.includes(status as KnowledgeBrowserStatus) ? status as KnowledgeBrowserStatus : "all" as const,
    coreOnly: params.get("core") === "1",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function matchesKnowledgeSearch(keyword: string, title: string, topic: string, category: string) {
  let searchable = normalizeChineseText(`${title} ${topic} ${category}`);
  for (const group of SEARCH_ALIASES) {
    const aliases = group.map(normalizeChineseText);
    if (aliases.some((alias) => searchable.includes(alias))) searchable += aliases.join("");
  }
  return keyword.split(/\s+/u).filter(Boolean).every((word) => searchable.includes(normalizeChineseText(word)));
}

export function matchesKnowledgeStatus(status: KnowledgeBrowserStatus, state: {
  attemptCount: number;
  mastery: number;
  nextReviewAt: string | null;
} | undefined, now: number, pauseStartedAt: number | null = null) {
  if (status === "all") return true;
  const learned = (state?.attemptCount ?? 0) > 0;
  if (status === "unlearned") return !learned;
  if (!state || !learned) return false;
  return status === "weak" ? state.mastery < 60 : isReviewDue(state, now, pauseStartedAt);
}

export function knowledgeReturnHref(value: string | null) {
  if (!value || value.length > 2500) return "/knowledge";
  try {
    const url = new URL(value, "https://offerpilot.invalid");
    if (url.origin !== "https://offerpilot.invalid" || url.pathname !== "/knowledge") return "/knowledge";
    return `${url.pathname}${url.search}#catalog`;
  } catch {
    return "/knowledge";
  }
}
