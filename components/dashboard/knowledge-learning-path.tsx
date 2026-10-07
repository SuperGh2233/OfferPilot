export type KnowledgeLearningPathItem = {
  topicId: string;
  name: string;
  category: string;
  depth: number;
  status: "ready" | "blocked";
  missingPrerequisiteNames: readonly string[];
};

export function KnowledgeLearningPath({
  items,
}: {
  items: readonly KnowledgeLearningPathItem[];
}) {
  const ready = items.filter((item) => item.status === "ready").slice(0, 4);
  const blocked = items.filter((item) => item.status === "blocked").slice(0, 4);

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Prerequisite DAG · Sprint 2
        </p>
        <h2 className="mt-1 text-xl font-semibold">当前学习路径</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          新学题只有在前置 Topic 达到基础掌握后才会进入 Planner；到期复习不受依赖图限制。
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
          <h3 className="font-semibold text-emerald-900 dark:text-emerald-200">现在可以继续学</h3>
          <div className="mt-3 space-y-2">
            {ready.length > 0 ? ready.map((item) => (
              <div className="flex items-center justify-between gap-3" key={item.topicId}>
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                </div>
                <span className="text-xs text-emerald-700 dark:text-emerald-300">层级 {item.depth}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">当前核心 Topic 已全部学习或还需要先巩固前置知识。</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <h3 className="font-semibold">尚未解锁</h3>
          <div className="mt-3 space-y-3">
            {blocked.length > 0 ? blocked.map((item) => (
              <div key={item.topicId}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{item.name}</p>
                  <span className="text-xs text-muted-foreground">{item.category}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  先完成：{item.missingPrerequisiteNames.join("、")}
                </p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">当前没有被前置知识阻塞的核心 Topic。</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
