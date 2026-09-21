export type NextTrainingTaskSource = "today" | "backlog" | "due";

export type NextTrainingTask = {
  id: string;
  source: NextTrainingTaskSource;
  date: string | null;
  taskType: string | null;
};

export type NextTrainingQueueTask = {
  id: string;
  date: string;
  status: "pending" | "in_progress" | "completed";
  sortOrder: number;
  taskType: string;
};

export type NextTrainingReviewState = {
  id: string;
  attemptCount: number;
  nextReviewAt: string | null;
};

export type NextTrainingCatalogItem = {
  id: string;
  order: number;
};

export function selectNextTrainingTask({
  currentId,
  todayKey,
  now,
  tasks,
  states,
  catalog,
  pauseStartedAt = null,
  preferredTaskType = null,
}: {
  currentId: string;
  todayKey: string;
  now: number;
  tasks: readonly NextTrainingQueueTask[];
  states: readonly NextTrainingReviewState[];
  catalog: readonly NextTrainingCatalogItem[];
  pauseStartedAt?: number | null;
  preferredTaskType?: string | null;
}): NextTrainingTask | null {
  if (!currentId.trim()) throw new RangeError("currentId must be non-empty");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayKey)) throw new RangeError("todayKey must use YYYY-MM-DD");
  if (!Number.isFinite(now)) throw new RangeError("now must be finite");
  if (pauseStartedAt !== null && !Number.isFinite(pauseStartedAt)) {
    throw new RangeError("pauseStartedAt must be finite or null");
  }

  const catalogOrder = new Map(catalog.map((item) => [item.id, item.order]));
  const queueCandidates = tasks
    .filter((task) =>
      task.id !== currentId
      && task.status !== "completed"
      && task.date <= todayKey
      && catalogOrder.has(task.id),
    )
    .sort((left, right) => {
      const leftRank = left.date === todayKey ? 0 : 1;
      const rightRank = right.date === todayKey ? 0 : 1;
      if (leftRank !== rightRank) return leftRank - rightRank;
      if (leftRank === 1 && left.date !== right.date) return left.date.localeCompare(right.date);
      if (preferredTaskType !== null) {
        const typeRank = Number(right.taskType === preferredTaskType) - Number(left.taskType === preferredTaskType);
        if (typeRank !== 0) return typeRank;
      }
      return left.sortOrder - right.sortOrder
        || (catalogOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER)
          - (catalogOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
        || left.id.localeCompare(right.id);
    });

  const queue = queueCandidates[0];
  if (queue) {
    return {
      id: queue.id,
      source: queue.date === todayKey ? "today" : "backlog",
      date: queue.date,
      taskType: queue.taskType,
    };
  }

  const due = states
    .filter((state) => {
      if (state.id === currentId || state.attemptCount <= 0 || !state.nextReviewAt || !catalogOrder.has(state.id)) {
        return false;
      }
      const dueAt = Date.parse(state.nextReviewAt);
      if (!Number.isFinite(dueAt)) return false;
      return pauseStartedAt === null ? dueAt <= now : dueAt < pauseStartedAt;
    })
    .sort((left, right) => {
      const leftDue = Date.parse(left.nextReviewAt!);
      const rightDue = Date.parse(right.nextReviewAt!);
      return leftDue - rightDue
        || (catalogOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER)
          - (catalogOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
        || left.id.localeCompare(right.id);
    })[0];

  return due ? { id: due.id, source: "due", date: null, taskType: "review" } : null;
}

export function nextTrainingTaskLabel(task: NextTrainingTask, learnMode = false) {
  if (task.source === "today") {
    return learnMode && task.taskType === "new" ? "学习下一题" : "继续下一题";
  }
  if (task.source === "backlog") return "继续补欠账";
  return "继续到期复习";
}
