import {
  ALGORITHM_DEMO_TIME_ZONE,
  getAlgorithmDemoDateKey,
  type StorageLike,
} from "../algorithm/demo-store";
import type { AlgorithmDateInput } from "../mastery/algorithm";

export const PROFILE_DEMO_STORAGE_KEY = "offerpilot:profile-demo:v1";
export const PROFILE_DEMO_CHANGED_EVENT = "offerpilot:profile-changed";

export const DEMO_TIME_ZONES = [
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Europe/London",
  "America/Los_Angeles",
  "UTC",
] as const;

export type DemoTimeZone = (typeof DEMO_TIME_ZONES)[number];

export type DemoProfile = {
  version: 1;
  displayName: string;
  timeZone: DemoTimeZone;
  planStartDate: string;
  dailyNewAlgorithmCount: number;
  dailyReviewAlgorithmCount: number;
  dailyNewKnowledgeCount: number;
  dailyReviewKnowledgeCount: number;
};

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isCount(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 100;
}

function isProfile(value: unknown): value is DemoProfile {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  return profile.version === 1
    && typeof profile.displayName === "string"
    && profile.displayName.trim().length <= 50
    && typeof profile.timeZone === "string"
    && DEMO_TIME_ZONES.includes(profile.timeZone as DemoTimeZone)
    && isDateKey(profile.planStartDate)
    && isCount(profile.dailyNewAlgorithmCount)
    && isCount(profile.dailyReviewAlgorithmCount)
    && isCount(profile.dailyNewKnowledgeCount)
    && isCount(profile.dailyReviewKnowledgeCount);
}

function normalizePlanStartDate(value: AlgorithmDateInput) {
  return typeof value === "string" && isDateKey(value)
    ? value
    : getAlgorithmDemoDateKey(value, ALGORITHM_DEMO_TIME_ZONE);
}

export function createDemoProfile(
  planStartDate: AlgorithmDateInput = new Date(),
): DemoProfile {
  return {
    version: 1,
    displayName: "",
    timeZone: ALGORITHM_DEMO_TIME_ZONE,
    planStartDate: normalizePlanStartDate(planStartDate),
    dailyNewAlgorithmCount: 2,
    dailyReviewAlgorithmCount: 1,
    dailyNewKnowledgeCount: 3,
    dailyReviewKnowledgeCount: 3,
  };
}

export function loadDemoProfile(
  storage: StorageLike,
  fallbackPlanStartDate: AlgorithmDateInput = new Date(),
) {
  try {
    const raw = storage.getItem(PROFILE_DEMO_STORAGE_KEY);
    if (!raw) return createDemoProfile(fallbackPlanStartDate);
    const parsed: unknown = JSON.parse(raw);
    return isProfile(parsed) ? parsed : createDemoProfile(fallbackPlanStartDate);
  } catch {
    return createDemoProfile(fallbackPlanStartDate);
  }
}

export function saveDemoProfile(storage: StorageLike, profile: DemoProfile) {
  try {
    if (!isProfile(profile)) return false;
    storage.setItem(PROFILE_DEMO_STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
