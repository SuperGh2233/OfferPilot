"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getAlgorithmTrainingDateKey } from "../algorithm/demo-store";
import type { CloudTrainingSnapshot } from "./training";
import { applyTrainingMutation, type TrainingMutation } from "./training-mutation";
import { loadCloudSnapshot } from "./training-client";

export function useCloudTrainingSnapshot(
  enabled: boolean,
  onSnapshot?: (snapshot: CloudTrainingSnapshot) => void,
) {
  const [snapshot, setSnapshotState] = useState<CloudTrainingSnapshot | null>(null);
  const snapshotRef = useRef<CloudTrainingSnapshot | null>(null);
  const snapshotVersionRef = useRef(0);
  const requestVersionRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<(() => Promise<CloudTrainingSnapshot | null>) | null>(null);
  const onSnapshotRef = useRef(onSnapshot);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  const setSnapshot = useCallback((value: CloudTrainingSnapshot) => {
    snapshotVersionRef.current += 1;
    snapshotRef.current = value;
    setSnapshotState(value);
    onSnapshotRef.current?.(value);
  }, []);

  const applyMutation = useCallback((mutation: TrainingMutation) => {
    const current = snapshotRef.current;
    if (!current) {
      // A write may already have committed; do not claim that it failed.
      void refreshRef.current?.();
      return;
    }
    setSnapshot(applyTrainingMutation(current, mutation));
  }, [setSnapshot]);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    const requestVersion = ++requestVersionRef.current;
    const snapshotVersion = snapshotVersionRef.current;
    setError(null);
    try {
      const value = await loadCloudSnapshot();
      // A mutation/import or newer refresh won the race: never overwrite it
      // with a snapshot taken before that write.
      if (requestVersion !== requestVersionRef.current || snapshotVersion !== snapshotVersionRef.current) {
        return snapshotRef.current;
      }
      setSnapshot(value);
      return value;
    } catch (loadError) {
      if (requestVersion === requestVersionRef.current && snapshotVersion === snapshotVersionRef.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "读取云端训练数据失败。",
        );
      }
      return null;
    }
  }, [enabled, setSnapshot]);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [enabled, refresh]);

  const timeZone = snapshot?.profile.timeZone;
  useEffect(() => {
    if (!enabled || !timeZone) return;
    let dateKey = getAlgorithmTrainingDateKey(new Date(), timeZone);
    const checkDate = () => {
      const nextDateKey = getAlgorithmTrainingDateKey(new Date(), timeZone);
      if (nextDateKey === dateKey) return;
      dateKey = nextDateKey;
      void refresh();
    };
    const interval = window.setInterval(checkDate, 30_000);
    window.addEventListener("focus", checkDate);
    document.addEventListener("visibilitychange", checkDate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkDate);
      document.removeEventListener("visibilitychange", checkDate);
    };
  }, [enabled, refresh, timeZone]);

  return { applyMutation, error, refresh, setError, setSnapshot, snapshot };
}
