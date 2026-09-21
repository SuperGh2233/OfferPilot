import { describe, expect, it } from "vitest";

import {
  createDemoProfile,
  loadDemoProfile,
  PROFILE_DEMO_STORAGE_KEY,
  saveDemoProfile,
} from "../lib/profile/demo-store";

function storage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: (key: string) => {
      void key;
      return value;
    },
    setItem: (_key: string, next: string) => { value = next; },
  };
}

describe("profile demo store", () => {
  it("creates defaults matching the database profile", () => {
    expect(createDemoProfile("2026-09-09")).toEqual({
      version: 1,
      displayName: "",
      timeZone: "Asia/Shanghai",
      planStartDate: "2026-09-09",
      dailyNewAlgorithmCount: 2,
      dailyReviewAlgorithmCount: 1,
      dailyNewKnowledgeCount: 3,
      dailyReviewKnowledgeCount: 3,
      pausePeriods: [],
    });
  });

  it("upgrades a saved profile that predates the pause feature", () => {
    const old = { ...createDemoProfile("2026-09-09") } as Record<string, unknown>;
    delete old.pausePeriods;
    expect(loadDemoProfile(storage(JSON.stringify(old))).pausePeriods).toEqual([]);
  });

  it("round-trips a valid profile", () => {
    const target = storage();
    const profile = {
      ...createDemoProfile("2026-09-09"),
      displayName: "秋招选手",
      timeZone: "UTC" as const,
      dailyNewAlgorithmCount: 4,
    };
    expect(saveDemoProfile(target, profile)).toBe(true);
    expect(loadDemoProfile(target, "2026-01-01")).toEqual(profile);
  });

  it("recovers corrupted or out-of-range data", () => {
    const invalid = {
      ...createDemoProfile("2026-09-09"),
      dailyReviewKnowledgeCount: 101,
    };
    expect(loadDemoProfile(storage(JSON.stringify(invalid)), "2026-01-02").planStartDate)
      .toBe("2026-01-02");
    expect(loadDemoProfile(storage("not-json"), "2026-01-03").planStartDate)
      .toBe("2026-01-03");
  });

  it("rejects invalid writes without changing storage", () => {
    const target = storage();
    expect(saveDemoProfile(target, {
      ...createDemoProfile("2026-09-09"),
      timeZone: "Mars/Olympus" as never,
    })).toBe(false);
    expect(target.getItem(PROFILE_DEMO_STORAGE_KEY)).toBeNull();
  });
});
