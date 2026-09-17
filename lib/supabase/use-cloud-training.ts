"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getAlgorithmTrainingDateKey } from "../algorithm/demo-store";
import type { CloudTrainingSnapshot } from "./training";
import { loadCloudSnapshot } from "./training-client";

export function useCloudTrainingSnapshot(
  enabled: boolean,
  onSnapshot?: (snapshot: CloudTrainingSnapshot) => void,
) {
  const [snapshot, setSnapshotState] = useState<CloudTrainingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onSnapshotRef = useRef(onSnapshot);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  const setSnapshot = useCallback((value: CloudTrainingSnapshot) => {
    setSnapshotState(value);
    onSnapshotRef.current?.(value);
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setError(null);
    try {
      const value = await loadCloudSnapshot();
      setSnapshot(value);
      return value;
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "读取云端训练数据失败。",
      );
      return null;
    }
  }, [enabled, setSnapshot]);

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

  return { error, refresh, setError, setSnapshot, snapshot };
}
