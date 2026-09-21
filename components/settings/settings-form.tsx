"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
  ALGORITHM_DEMO_CHANGED_EVENT,
  getAlgorithmTrainingDateKey,
  getTrainingDayStart,
  loadAlgorithmDemoData,
  saveAlgorithmDemoData,
} from "@/lib/algorithm/demo-store";
import {
  KNOWLEDGE_DEMO_CHANGED_EVENT,
  loadKnowledgeDemoData,
  saveKnowledgeDemoData,
} from "@/lib/knowledge/demo-store";
import {
  DEMO_TIME_ZONES,
  loadDemoProfile,
  PROFILE_DEMO_CHANGED_EVENT,
  saveDemoProfile,
  type DemoProfile,
} from "@/lib/profile/demo-store";
import { changePlanPause, deferReviewDate, isPlanPaused, pauseDurationDays } from "@/lib/profile/pause";
import { saveCloudProfile, setCloudPlanPaused } from "@/lib/supabase/training-client";
import { useCloudTrainingSnapshot } from "@/lib/supabase/use-cloud-training";

const TIME_ZONE_LABELS: Readonly<Record<string, string>> = {
  "Asia/Shanghai": "中国标准时间 · Asia/Shanghai",
  "Asia/Tokyo": "日本标准时间 · Asia/Tokyo",
  "Europe/London": "英国时间 · Europe/London",
  "America/Los_Angeles": "美国太平洋时间 · America/Los_Angeles",
  UTC: "协调世界时 · UTC",
};

type CountKey =
  | "dailyNewAlgorithmCount"
  | "dailyReviewAlgorithmCount"
  | "dailyNewKnowledgeCount"
  | "dailyReviewKnowledgeCount";

export function SettingsForm({ demoMode }: { demoMode: boolean }) {
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pausing, setPausing] = useState(false);
  const cloud = useCloudTrainingSnapshot(!demoMode);

  useEffect(() => {
    if (!demoMode) return;
    const initialLoad = window.setTimeout(() => {
      const algorithm = loadAlgorithmDemoData(window.localStorage);
      setProfile(loadDemoProfile(window.localStorage, algorithm.planStartDate));
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [demoMode]);

  const activeProfile = profile ?? cloud.snapshot?.profile ?? null;

  if (cloud.error) {
    return <p aria-live="assertive" className="mt-8 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{cloud.error}</p>;
  }
  if (!activeProfile) {
    return <p className="mt-8 text-sm text-muted-foreground">正在读取训练设置…</p>;
  }
  const currentProfile = activeProfile;

  function updateCount(key: CountKey, value: string) {
    const count = Number(value);
    setProfile((current) => ({ ...(current ?? currentProfile), [key]: count }));
    setMessage(null);
  }

  async function togglePause() {
    if (pausing) return;
    setPausing(true);
    setError(null);
    setMessage(null);
    try {
      let paused: boolean;
      if (!demoMode) {
        paused = !isPlanPaused(cloud.snapshot?.profile.pausePeriods ?? []);
        const result = await setCloudPlanPaused(paused);
        cloud.setSnapshot(result.snapshot);
        setProfile(result.profile);
      } else {
        const stored = loadDemoProfile(window.localStorage);
        const prior = stored.pausePeriods ?? [];
        paused = !isPlanPaused(prior);
        const day = getAlgorithmTrainingDateKey(new Date(), stored.timeZone);
        const updated = { ...stored, pausePeriods: changePlanPause(prior, paused, day) };
        const algorithm = loadAlgorithmDemoData(window.localStorage, new Date(), stored.timeZone);
        const knowledge = loadKnowledgeDemoData(window.localStorage, new Date(), stored.timeZone);
        if (!paused) {
          const last = prior.at(-1)!;
          const days = pauseDurationDays(last.start, day);
          const start = getTrainingDayStart(last.start, stored.timeZone);
          for (const state of Object.values(algorithm.states)) {
            if (state.lastAttemptAt && state.lastAttemptAt >= start) continue;
            state.nextReviewAt = deferReviewDate(state.nextReviewAt, start, days);
            if (state.status === "due" && Date.parse(state.nextReviewAt) > Date.now()) state.status = "learning";
          }
          for (const state of Object.values(knowledge.states)) {
            if (state.lastAttemptAt && state.lastAttemptAt >= start) continue;
            state.nextReviewAt = deferReviewDate(state.nextReviewAt, start, days);
            if (state.status === "due" && Date.parse(state.nextReviewAt) > Date.now()) state.status = "learning";
          }
        }
        if (!saveAlgorithmDemoData(window.localStorage, algorithm)
          || !saveKnowledgeDemoData(window.localStorage, knowledge)
          || !saveDemoProfile(window.localStorage, updated)) {
          throw new Error("暂停状态保存失败，请检查浏览器存储空间。");
        }
        setProfile(updated);
        window.dispatchEvent(new Event(PROFILE_DEMO_CHANGED_EVENT));
        window.dispatchEvent(new Event(ALGORITHM_DEMO_CHANGED_EVENT));
        window.dispatchEvent(new Event(KNOWLEDGE_DEMO_CHANGED_EVENT));
      }
      setMessage(paused
        ? "已暂停计划。暂停期间不会生成新日任务。"
        : "计划已恢复，将从今天继续安排训练。");
    } catch (pauseError) {
      setError(pauseError instanceof Error ? pauseError.message : "修改计划状态失败。");
    } finally {
      setPausing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const nextProfile = {
      ...currentProfile,
      displayName: currentProfile.displayName.trim(),
      // The pause toggle owns this field; stale settings forms must not undo it.
      pausePeriods: demoMode
        ? loadDemoProfile(window.localStorage).pausePeriods ?? []
        : cloud.snapshot?.profile.pausePeriods ?? currentProfile.pausePeriods ?? [],
    };
    if (!demoMode) {
      try {
        const result = await saveCloudProfile(nextProfile);
        setProfile(result.profile);
        cloud.setSnapshot(result.snapshot);
        setMessage("设置已保存到数据库；新的任务数量从下一个尚未生成的训练日生效。");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "保存云端设置失败。");
      }
      return;
    }

    const algorithm = {
      ...loadAlgorithmDemoData(window.localStorage, new Date(), nextProfile.timeZone),
      planStartDate: nextProfile.planStartDate,
    };
    const knowledge = {
      ...loadKnowledgeDemoData(window.localStorage, new Date(), nextProfile.timeZone),
      planStartDate: nextProfile.planStartDate,
    };
    if (
      !saveAlgorithmDemoData(window.localStorage, algorithm)
      || !saveKnowledgeDemoData(window.localStorage, knowledge)
      || !saveDemoProfile(window.localStorage, nextProfile)
    ) {
      setError("保存失败，请检查字段范围或浏览器存储空间。");
      return;
    }

    setProfile(nextProfile);
    setMessage("设置已保存；新的任务数量从下一个尚未生成的训练日生效。");
    window.dispatchEvent(new Event(PROFILE_DEMO_CHANGED_EVENT));
    window.dispatchEvent(new Event(ALGORITHM_DEMO_CHANGED_EVENT));
    window.dispatchEvent(new Event(KNOWLEDGE_DEMO_CHANGED_EVENT));
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={submit}>
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="font-semibold">个人计划</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="显示名">
            <input
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              maxLength={50}
              onChange={(event) => setProfile({ ...currentProfile, displayName: event.target.value })}
              placeholder="例如：秋招选手"
              value={currentProfile.displayName}
            />
          </Field>
          <Field label="计划开始日期">
            <input
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) => setProfile({ ...currentProfile, planStartDate: event.target.value })}
              required
              type="date"
              value={currentProfile.planStartDate}
            />
          </Field>
          <Field label="时区">
            <select
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) => setProfile({ ...currentProfile, timeZone: event.target.value as DemoProfile["timeZone"] })}
              value={currentProfile.timeZone}
            >
              {DEMO_TIME_ZONES.map((timeZone) => (
                <option key={timeZone} value={timeZone}>{TIME_ZONE_LABELS[timeZone]}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-6 rounded-xl border bg-muted/30 p-4">
          <p className="font-medium">{isPlanPaused(currentProfile.pausePeriods ?? []) ? "计划已暂停" : "计划进行中"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            暂停期间不生成新任务、不计漏训、不推进 42 天周期。恢复后保留历史，暂停期间新到期的复习顺延。
          </p>
          <button
            className="mt-3 h-10 rounded-lg border bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
            disabled={pausing}
            onClick={() => void togglePause()}
            type="button"
          >
            {pausing ? "正在保存…" : isPlanPaused(currentProfile.pausePeriods ?? []) ? "恢复计划" : "暂停计划"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="font-semibold">每日任务数量</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          已生成的当天任务不会被重写，避免覆盖完成状态。
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <CountField label="Algorithm 新题" onChange={(value) => updateCount("dailyNewAlgorithmCount", value)} value={currentProfile.dailyNewAlgorithmCount} />
          <CountField label="Algorithm 复习" onChange={(value) => updateCount("dailyReviewAlgorithmCount", value)} value={currentProfile.dailyReviewAlgorithmCount} />
          <CountField label="Knowledge 新学" onChange={(value) => updateCount("dailyNewKnowledgeCount", value)} value={currentProfile.dailyNewKnowledgeCount} />
          <CountField label="Knowledge 复习" onChange={(value) => updateCount("dailyReviewKnowledgeCount", value)} value={currentProfile.dailyReviewKnowledgeCount} />
        </div>
      </section>

      {error ? <p aria-live="assertive" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}
      {message ? <p aria-live="polite" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" role="status">{message}</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <button className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/85" type="submit">
          保存设置
        </button>
        <Link className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline" href="/dashboard">
          返回 Dashboard
        </Link>
      </div>
    </form>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function CountField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: number;
}) {
  return (
    <Field label={label}>
      <input
        className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        max={100}
        min={0}
        onChange={(event) => onChange(event.target.value)}
        required
        type="number"
        value={value}
      />
    </Field>
  );
}
