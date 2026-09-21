import {
  loadAlgorithmDemoData,
} from "../algorithm/demo-store";
import { loadKnowledgeDemoData } from "../knowledge/demo-store";
import { loadDemoProfile, type DemoProfile } from "../profile/demo-store";
import type {
  CloudTrainingSnapshot,
  CancelCloudAlgorithmInput,
  CompleteCloudAlgorithmInput,
  RecordCloudKnowledgeInput,
  SaveCloudAlgorithmAnalysisInput,
} from "./training";
import type { TrainingMutation } from "./training-mutation";

type MutationResponse<K extends TrainingMutation["kind"]> = {
  mutation: Extract<TrainingMutation, { kind: K }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const value: unknown = await response.json();
  if (!response.ok) {
    const message =
      value !== null &&
      typeof value === "object" &&
      "error" in value &&
      typeof value.error === "string"
        ? value.error
        : "云端训练服务暂时不可用。";
    throw new Error(message);
  }
  return value as T;
}

export async function loadCloudSnapshot() {
  const result = await request<{
    snapshot: CloudTrainingSnapshot | null;
    needsImport?: boolean;
  }>(
    "/api/training/snapshot",
  );
  if (result.snapshot) return result.snapshot;
  if (!result.needsImport || typeof window === "undefined") {
    throw new Error("训练数据库尚未初始化。");
  }

  const now = new Date();
  const algorithm = loadAlgorithmDemoData(window.localStorage, now);
  const profile = loadDemoProfile(window.localStorage, algorithm.planStartDate);
  const knowledge = loadKnowledgeDemoData(window.localStorage, now, profile.timeZone);
  return request<{ snapshot: CloudTrainingSnapshot }>(
    "/api/training/snapshot",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot: { algorithm, knowledge, profile } }),
    },
  ).then((value) => value.snapshot);
}

export async function startCloudAttempt(problemId: string) {
  return request<MutationResponse<"algorithm_start">>("/api/training/algorithm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", problemId }),
  });
}

export async function cancelCloudAttempt(input: CancelCloudAlgorithmInput) {
  return request<MutationResponse<"algorithm_cancel">>("/api/training/algorithm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel", ...input }),
  });
}

export async function completeCloudAttempt(input: CompleteCloudAlgorithmInput) {
  return request<MutationResponse<"algorithm_complete">>("/api/training/algorithm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", ...input }),
  });
}

export async function saveCloudAlgorithmAnalysis(input: SaveCloudAlgorithmAnalysisInput) {
  return request<MutationResponse<"algorithm_analysis">>("/api/training/algorithm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save_ai_analysis", ...input }),
  });
}

export async function importCloudAlgorithms(problemIds: readonly string[]) {
  return request<{
    importedCount: number;
    skippedCount: number;
    snapshot: CloudTrainingSnapshot;
  }>("/api/training/algorithm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "import_completed", problemIds }),
  });
}

export async function recordCloudKnowledge(input: RecordCloudKnowledgeInput) {
  return request<MutationResponse<"knowledge_record">>("/api/training/knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function setCloudPlanPaused(paused: boolean) {
  return request<{ profile: DemoProfile; snapshot: CloudTrainingSnapshot }>(
    "/api/training/profile",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused }),
    },
  );
}

export async function saveCloudProfile(profile: DemoProfile) {
  return request<{ profile: DemoProfile; snapshot: CloudTrainingSnapshot }>(
    "/api/training/profile",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    },
  );
}
