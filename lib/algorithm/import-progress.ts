import type { AlgorithmCatalogProblem } from "./catalog";
import type {
  AlgorithmDemoData,
  LocalAlgorithmTask,
} from "./demo-store";
import { calculateNextAlgorithmReview } from "../mastery/algorithm";

export const IMPORTED_ALGORITHM_MASTERY = 60;

export type AlgorithmImportPreview = {
  problemIds: string[];
  unmatchedEntries: string[];
};

export type AlgorithmImportResult = {
  data: AlgorithmDemoData;
  importedCount: number;
  skippedCount: number;
};

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function problemSlug(url: string) {
  return url.match(/\/problems\/([^/?#]+)/i)?.[1]?.toLocaleLowerCase() ?? null;
}

export function parseAlgorithmImport(
  input: string,
  problems: readonly AlgorithmCatalogProblem[],
): AlgorithmImportPreview {
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  const bySlug = new Map(
    problems.flatMap((problem) => {
      const slug = problemSlug(problem.url);
      return slug ? [[slug, problem] as const] : [];
    }),
  );
  const byTitle = problems
    .flatMap((problem) => [
      [normalized(problem.title), problem] as const,
      [normalized(problem.titleEn), problem] as const,
    ])
    .filter(([title]) => title.length > 0)
    .sort(([left], [right]) => right.length - left.length);
  const entries = input
    .split(/[\n,，;；]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const matched = new Set<string>();
  const unmatchedEntries: string[] = [];

  for (const entry of entries) {
    const slug = problemSlug(entry);
    const id = entry.match(/\[(\d{1,5})\]/)?.[1]
      ?? entry.match(/#(\d{1,5})\b/)?.[1]
      ?? entry.match(/^[✓✔\s]*(\d{1,5})(?:\s|$)/)?.[1]
      ?? (/^\d{1,5}$/.test(entry) ? entry : null);
    const entryText = normalized(entry);
    const problem = (id ? byId.get(id) : undefined)
      ?? (slug ? bySlug.get(slug) : undefined)
      ?? byTitle.find(([title]) => entryText.includes(title))?.[1];

    if (problem) matched.add(problem.id);
    else unmatchedEntries.push(entry);
  }

  return { problemIds: [...matched], unmatchedEntries };
}

export function importCompletedAlgorithmProblems({
  data,
  importedAt,
  problemIds,
  userId,
}: {
  data: AlgorithmDemoData;
  importedAt: Date | string;
  problemIds: readonly string[];
  userId: string;
}): AlgorithmImportResult {
  const importedDate = importedAt instanceof Date
    ? new Date(importedAt.getTime())
    : new Date(importedAt);
  if (!Number.isFinite(importedDate.getTime())) {
    throw new RangeError("importedAt must be a valid date");
  }

  const uniqueIds = [...new Set(problemIds.map((id) => id.trim()).filter(Boolean))];
  const importableIds = uniqueIds.filter((id) => !data.states[id]);
  if (importableIds.length === 0) {
    return { data, importedCount: 0, skippedCount: uniqueIds.length };
  }

  const timestamp = importedDate.toISOString();
  const importedIdSet = new Set(importableIds);
  const states = { ...data.states };
  for (const problemId of importableIds) {
    states[problemId] = {
      userId,
      problemId,
      mastery: IMPORTED_ALGORITHM_MASTERY,
      attemptCount: 1,
      lastAttemptAt: timestamp,
      nextReviewAt: calculateNextAlgorithmReview(
        IMPORTED_ALGORITHM_MASTERY,
        importedDate,
      ).toISOString(),
      status: "learning",
      lastResult: "first_ac",
      independentAcCount: 0,
      lastIndependentAcAt: null,
      spacedIndependentAcAt: null,
    };
  }

  const dailyTasks = Object.fromEntries(
    Object.entries(data.dailyTasks).map(([date, tasks]) => [
      date,
      tasks.map((task): LocalAlgorithmTask =>
        importedIdSet.has(task.problemId) && task.status !== "completed"
          ? { ...task, status: "completed", completedAt: timestamp }
          : task,
      ),
    ]),
  );

  return {
    data: { ...data, states, dailyTasks },
    importedCount: importableIds.length,
    skippedCount: uniqueIds.length - importableIds.length,
  };
}
