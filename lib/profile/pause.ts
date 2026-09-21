/** Training-day ranges are [start, end); end=null means manually paused. */
export type PlanPausePeriod = { start: string; end: string | null };

const DAY_MS = 86_400_000;

export function isPlanPauseHistory(value: unknown): value is PlanPausePeriod[] {
  if (!Array.isArray(value) || value.length > 500) return false;
  let lastEnd: string | null = null;
  for (let i = 0; i < value.length; i += 1) {
    const period = value[i];
    if (!period || typeof period !== "object" || Array.isArray(period)) return false;
    const { start, end } = period as Record<string, unknown>;
    if (typeof start !== "string" || !isDateKey(start)
      || (end !== null && (typeof end !== "string" || !isDateKey(end) || end < start))
      || (lastEnd !== null && start < lastEnd)
      || (i > 0 && lastEnd === null)) return false;
    lastEnd = end as string | null;
  }
  return true;
}

export function isDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = new Date(`${key}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key;
}

export function isPlanPaused(periods: readonly PlanPausePeriod[]): boolean {
  return periods.length > 0 && periods[periods.length - 1].end === null;
}

export function isPausedTrainingDay(day: string, periods: readonly PlanPausePeriod[]): boolean {
  return periods.some(({ start, end }) => start <= day && (end === null || day < end));
}

export function shiftTrainingDate(day: string, offset: number): string {
  if (!isDateKey(day) || !Number.isSafeInteger(offset)) throw new RangeError("Invalid training date");
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + offset * DAY_MS).toISOString().slice(0, 10);
}

/** First-cycle length counts training days, never calendar days off. */
export function activeTrainingDates(
  start: string,
  before: string,
  periods: readonly PlanPausePeriod[],
  limit = 42,
): string[] {
  if (!isDateKey(start) || !isDateKey(before)) throw new RangeError("Invalid plan date");
  const result: string[] = [];
  let day = start;
  // Bound traversal even for accidentally distant user-configured plan starts.
  for (let n = 0; day < before && result.length < limit && n < 100_000; n += 1) {
    if (!isPausedTrainingDay(day, periods)) result.push(day);
    day = shiftTrainingDate(day, 1);
  }
  return result;
}

export function activeTrainingDayNumber(
  start: string,
  today: string,
  periods: readonly PlanPausePeriod[],
): number {
  if (today < start) return 1;
  let total = 0;
  for (let day = start, n = 0; day < today && n < 100_000; day = shiftTrainingDate(day, 1), n += 1) {
    if (!isPausedTrainingDay(day, periods)) total += 1;
  }
  return total + 1;
}

export function changePlanPause(
  periods: readonly PlanPausePeriod[],
  paused: boolean,
  today: string,
): PlanPausePeriod[] {
  if (!isDateKey(today) || !isPlanPauseHistory(periods)) throw new RangeError("Invalid plan pause history");
  if (paused === isPlanPaused(periods)) return [...periods];
  if (paused) {
    const last = periods.at(-1);
    if (last && last.end !== null && today < last.end) throw new RangeError("Pause date precedes previous resume");
    if (periods.length >= 500) throw new RangeError("Too many pause periods");
    return [...periods, { start: today, end: null }];
  }
  const last = periods.at(-1)!;
  if (today < last.start) throw new RangeError("Resume date precedes pause");
  return [...periods.slice(0, -1), { ...last, end: today }];
}

export function pauseDurationDays(start: string, end: string): number {
  return Math.max(0, (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / DAY_MS);
}

/** Defers reviews that became due at or after the pause started; previously overdue items stay overdue. */
export function deferReviewDate(nextReviewAt: string, pauseStartedAt: string, days: number): string {
  if (days <= 0 || Date.parse(nextReviewAt) < Date.parse(pauseStartedAt)) return nextReviewAt;
  return new Date(Date.parse(nextReviewAt) + days * DAY_MS).toISOString();
}
