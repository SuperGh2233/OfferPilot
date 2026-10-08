import {
  selectNextTrainingTask,
  type NextTrainingCatalogItem,
  type NextTrainingQueueTask,
  type NextTrainingReviewState,
} from "./next-task";

type TrainingQueue = {
  tasks: readonly NextTrainingQueueTask[];
  states: readonly NextTrainingReviewState[];
  catalog: readonly NextTrainingCatalogItem[];
};

export function getDailyTrainingFocus({
  algorithm,
  knowledge,
  todayKey,
  planStartDate,
  now,
  pauseStartedAt = null,
}: {
  algorithm: TrainingQueue;
  knowledge: TrainingQueue;
  todayKey: string;
  planStartDate: string;
  now: number;
  pauseStartedAt?: number | null;
}) {
  const queues = [{ kind: "algorithm" as const, ...algorithm }, { kind: "knowledge" as const, ...knowledge }];
  const candidates = queues.flatMap((queue) => {
    const next = selectNextTrainingTask({
      ...queue,
      currentId: null,
      todayKey,
      planStartDate,
      now,
      pauseStartedAt,
      preferInProgress: true,
    });
    if (!next) return [];
    return [{
      ...next,
      kind: queue.kind,
      inProgress: queue.tasks.some((task) => task.id === next.id && task.status === "in_progress"),
      dueAt: queue.states.find((state) => state.id === next.id)?.nextReviewAt ?? "",
      href: `/${queue.kind}/${encodeURIComponent(next.id)}`,
    }];
  }).sort((left, right) => {
    const ranks = { today: 0, backlog: 1, due: 2 };
    return ranks[left.source] - ranks[right.source]
      || (left.source === "due" && right.source === "due"
        ? Date.parse(left.dueAt) - Date.parse(right.dueAt)
        : (left.date ?? "").localeCompare(right.date ?? ""))
      || Number(right.inProgress) - Number(left.inProgress);
  });
  const today = queues.flatMap((queue) => queue.tasks.filter((task) => task.date === todayKey && task.date >= planStartDate)
    .map((task) => ({ ...task, kind: queue.kind })));
  const remaining = today.filter((task) => task.status !== "completed");
  const estimatedMinutes = remaining.reduce((total, task) => total + (task.kind === "algorithm"
    ? task.taskType === "new" ? 25 : 15
    : task.taskType === "new" ? 8 : 5), 0);
  const algorithmCompleted = today.filter((task) => task.kind === "algorithm" && task.status === "completed").length;
  const knowledgeCompleted = today.filter((task) => task.kind === "knowledge" && task.status === "completed").length;
  return {
    next: candidates[0] ?? null,
    remaining: remaining.length,
    total: today.length,
    algorithmCompleted,
    knowledgeCompleted,
    estimatedMinutes,
    // A paused or empty day is not a completed training day.
    dayComplete: pauseStartedAt === null && today.length > 0 && remaining.length === 0,
  };
}
