import type { KnowledgeAbilityNode } from "@/lib/knowledge-graph/mastery";

function scoreLabel(node: KnowledgeAbilityNode) {
  if (node.attemptedQuestions === 0) return "尚未学习";
  if (node.mastery >= 80) return "较稳";
  if (node.mastery >= 60) return "在巩固";
  return "需补强";
}

export function KnowledgeAbilityMap({
  categories,
  topics,
}: {
  categories: readonly KnowledgeAbilityNode[];
  topics: readonly KnowledgeAbilityNode[];
}) {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Knowledge Graph · Sprint 1
          </p>
          <h2 className="mt-1 text-xl font-semibold">面试能力地图</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            当前按「领域 → Topic → 题目」聚合现有 Mastery；覆盖率与能力分分开显示，未学习题不会被隐藏。
          </p>
        </div>
        <span className="text-xs text-muted-foreground">依赖关系将在 Sprint 2 加入</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => {
          const categoryTopics = topics
            .filter((topic) => topic.parentId === category.id)
            .filter((topic) => topic.attemptedQuestions > 0)
            .sort((left, right) => left.mastery - right.mastery || left.order - right.order)
            .slice(0, 3);
          return (
            <article className="rounded-xl border bg-muted/20 p-4" key={category.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{category.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    已学习 {category.attemptedQuestions}/{category.totalQuestions} · 覆盖 {Math.round(category.coverage)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold">{Math.round(category.mastery)}%</p>
                  <p className="text-xs text-muted-foreground">{scoreLabel(category)}</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  aria-label={`${category.name} 能力 ${Math.round(category.mastery)}%`}
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(0, Math.min(100, category.mastery))}%` }}
                />
              </div>
              {categoryTopics.length > 0 ? (
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">当前较弱 Topic</p>
                  <div className="mt-2 space-y-2">
                    {categoryTopics.map((topic) => (
                      <div className="flex items-center justify-between gap-3 text-sm" key={topic.id}>
                        <span className="truncate">{topic.name}</span>
                        <span className="shrink-0 text-xs font-medium">
                          {Math.round(topic.mastery)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                  完成该领域任一道 Learn / Recall 后开始形成能力画像。
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
