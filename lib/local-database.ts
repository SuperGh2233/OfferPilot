import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { getAlgorithmProblem, algorithmCatalog, toAlgorithmPlannerProblem } from "./algorithm/catalog";
import { importCompletedAlgorithmProblems } from "./algorithm/import-progress";
import {
  attachDemoAlgorithmAnalysis,
  completeDemoAlgorithmAttempt,
  createAlgorithmDemoData,
  ensureTodayAlgorithmTasks,
  saveAlgorithmDemoData,
  startDemoAlgorithmAttempt,
  type AlgorithmDemoData,
  type StorageLike,
} from "./algorithm/demo-store";
import type { AlgorithmCodeAnalysis } from "./ai/code-analysis";
import {
  getKnowledgeQuestion,
  knowledgeQuestions,
  toKnowledgePlannerQuestion,
} from "./knowledge/catalog";
import {
  createKnowledgeDemoData,
  ensureTodayKnowledgeTasks,
  learnDemoKnowledgeQuestion,
  recallDemoKnowledgeQuestion,
  saveKnowledgeDemoData,
  type KnowledgeDemoData,
} from "./knowledge/demo-store";
import {
  createDemoProfile,
  saveDemoProfile,
  type DemoProfile,
} from "./profile/demo-store";
import type {
  CloudTrainingSnapshot,
  CompleteCloudAlgorithmInput,
  RecordCloudKnowledgeInput,
} from "./supabase/training";
import type { CompleteAlgorithmAttemptResult } from "./algorithm/attempts";

type LocalTrainingState = {
  profile: DemoProfile;
  algorithm: AlgorithmDemoData;
  knowledge: KnowledgeDemoData;
};

type StoredRow = { payload: string };

export class LocalTrainingConflictError extends Error {}

class CaptureStorage implements StorageLike {
  getItem() {
    return null;
  }

  setItem() {}
}

function validateState(state: LocalTrainingState) {
  const storage = new CaptureStorage();
  if (
    !saveDemoProfile(storage, state.profile)
    || !saveAlgorithmDemoData(storage, state.algorithm)
    || !saveKnowledgeDemoData(storage, state.knowledge)
  ) {
    throw new RangeError("本地数据库训练数据无效。");
  }
}

function freshState(now: Date): LocalTrainingState {
  const profile = createDemoProfile(now);
  return {
    profile,
    algorithm: createAlgorithmDemoData(profile.planStartDate, profile.timeZone),
    knowledge: createKnowledgeDemoData(profile.planStartDate, profile.timeZone),
  };
}

function snapshotFromState(state: LocalTrainingState): CloudTrainingSnapshot {
  return {
    profile: state.profile,
    algorithm: state.algorithm,
    knowledge: state.knowledge,
  };
}

export class LocalTrainingDatabase {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec(`
      pragma journal_mode = WAL;
      create table if not exists local_training_state (
        id integer primary key check (id = 1),
        payload text not null,
        updated_at text not null
      );
    `);
  }

  close() {
    this.database.close();
  }

  private readState(): LocalTrainingState | null {
    const row = this.database
      .prepare("select payload from local_training_state where id = 1")
      .get() as StoredRow | undefined;
    if (!row) return null;
    const state = JSON.parse(row.payload) as LocalTrainingState;
    validateState(state);
    return state;
  }

  private writeState(state: LocalTrainingState) {
    validateState(state);
    this.database.prepare(`
      insert into local_training_state (id, payload, updated_at)
      values (1, ?, ?)
      on conflict (id) do update set
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(state), new Date().toISOString());
  }

  private ensureToday(state: LocalTrainingState, now: Date) {
    const algorithm = ensureTodayAlgorithmTasks(
      state.algorithm,
      algorithmCatalog.map(toAlgorithmPlannerProblem),
      now,
      {
        newCount: state.profile.dailyNewAlgorithmCount,
        reviewCount: state.profile.dailyReviewAlgorithmCount,
        timeZone: state.profile.timeZone,
      },
    );
    const knowledge = ensureTodayKnowledgeTasks(
      state.knowledge,
      knowledgeQuestions.map(toKnowledgePlannerQuestion),
      now,
      {
        newCount: state.profile.dailyNewKnowledgeCount,
        reviewCount: state.profile.dailyReviewKnowledgeCount,
        timeZone: state.profile.timeZone,
      },
    );
    if (algorithm.data !== state.algorithm || knowledge.data !== state.knowledge) {
      state.algorithm = algorithm.data;
      state.knowledge = knowledge.data;
      this.writeState(state);
    }
    return state;
  }

  peekSnapshot(now = new Date()): CloudTrainingSnapshot | null {
    const state = this.readState();
    return state ? snapshotFromState(this.ensureToday(state, now)) : null;
  }

  loadSnapshot(now = new Date()): CloudTrainingSnapshot {
    const stored = this.readState();
    const state = stored ?? freshState(now);
    if (!stored) this.writeState(state);
    return snapshotFromState(this.ensureToday(state, now));
  }

  importSnapshot(snapshot: CloudTrainingSnapshot, now = new Date()) {
    const state: LocalTrainingState = {
      profile: snapshot.profile,
      algorithm: { ...snapshot.algorithm, planStartDate: snapshot.profile.planStartDate },
      knowledge: { ...snapshot.knowledge, planStartDate: snapshot.profile.planStartDate },
    };
    this.writeState(state);
    return snapshotFromState(this.ensureToday(state, now));
  }

  startAlgorithm(problemId: string, startedAt = new Date()) {
    if (!getAlgorithmProblem(problemId)) throw new RangeError("Unknown Hot 100 problem");
    const state = this.ensureToday(this.readState() ?? freshState(startedAt), startedAt);
    const result = startDemoAlgorithmAttempt({
      data: state.algorithm,
      problemId,
      startedAt,
      attemptId: crypto.randomUUID(),
      timeZone: state.profile.timeZone,
    });
    state.algorithm = result.data;
    this.writeState(state);
    return result.attempt;
  }

  importAlgorithms(problemIds: readonly string[], importedAt = new Date()) {
    const uniqueIds = [...new Set(problemIds)];
    if (uniqueIds.length === 0 || uniqueIds.some((id) => !getAlgorithmProblem(id))) {
      throw new RangeError("只能导入 Hot 100 中的有效题目。");
    }
    const state = this.ensureToday(this.readState() ?? freshState(importedAt), importedAt);
    const result = importCompletedAlgorithmProblems({
      data: state.algorithm,
      importedAt,
      problemIds: uniqueIds,
      userId: "local-demo",
    });
    state.algorithm = result.data;
    this.writeState(state);
    return {
      importedCount: result.importedCount,
      skippedCount: result.skippedCount,
    };
  }

  completeAlgorithm(input: CompleteCloudAlgorithmInput): CompleteAlgorithmAttemptResult {
    const state = this.readState();
    if (!state) throw new LocalTrainingConflictError("本地训练记录不存在。");
    const existing = state.algorithm.attempts.find(({ id }) => id === input.attemptId);
    if (existing) {
      const savedState = state.algorithm.states[input.problemId];
      if (!savedState) throw new LocalTrainingConflictError("本地训练状态不存在。");
      return { attempt: existing, state: savedState };
    }
    const active = state.algorithm.activeAttempts[input.problemId];
    if (!active || active.id !== input.attemptId) {
      throw new LocalTrainingConflictError("训练状态已在其他页面更新。");
    }
    const problem = getAlgorithmProblem(input.problemId);
    if (!problem) throw new RangeError("Unknown Hot 100 problem");
    const { data, ...completion } = completeDemoAlgorithmAttempt({
      data: state.algorithm,
      problemId: input.problemId,
      difficulty: problem.difficulty,
      finishedAt: input.finishedAt,
      result: input.result,
      independence: input.independence,
      waCount: input.waCount,
      mistakeTags: input.mistakeTags,
      code: input.code,
      aiAnalysis: input.aiAnalysis,
      timeZone: state.profile.timeZone,
    });
    state.algorithm = data;
    this.writeState(state);
    return completion;
  }

  saveAlgorithmAnalysis(input: {
    attemptId: string;
    problemId: string;
    aiAnalysis: AlgorithmCodeAnalysis;
  }) {
    const state = this.readState();
    if (!state) throw new LocalTrainingConflictError("本地训练记录不存在。");
    const result = attachDemoAlgorithmAnalysis({ data: state.algorithm, ...input });
    state.algorithm = result.data;
    this.writeState(state);
    return result.attempt;
  }

  recordKnowledge(input: RecordCloudKnowledgeInput) {
    const state = this.readState();
    if (!state) throw new LocalTrainingConflictError("本地训练记录不存在。");
    const existing = state.knowledge.attempts.find(({ id }) => id === input.attemptId);
    if (existing) {
      const savedState = state.knowledge.states[input.questionId];
      if (!savedState) throw new LocalTrainingConflictError("本地训练状态不存在。");
      return { attempt: existing, state: savedState };
    }
    const question = getKnowledgeQuestion(input.questionId);
    if (!question) throw new RangeError("Unknown knowledge question");
    const result = input.mode === "learn"
      ? learnDemoKnowledgeQuestion({
          data: state.knowledge,
          questionId: input.questionId,
          selfRating: input.selfRating,
          attemptedAt: input.attemptedAt,
          id: input.attemptId,
          timeZone: state.profile.timeZone,
        })
      : recallDemoKnowledgeQuestion({
          data: state.knowledge,
          questionId: input.questionId,
          answerText: input.answerText,
          keyPoints: question.keyPoints,
          keywordAliases: question.keywordAliases,
          keyPointWeights: question.keyPointWeights,
          attemptedAt: input.attemptedAt,
          id: input.attemptId,
          timeZone: state.profile.timeZone,
        });
    state.knowledge = result.data;
    this.writeState(state);
    return "attemptScore" in result
      ? {
          attempt: result.attempt,
          state: result.state,
          attemptScore: result.attemptScore,
        }
      : { attempt: result.attempt, state: result.state };
  }

  updateProfile(profile: DemoProfile) {
    const state = this.readState() ?? freshState(new Date());
    const candidate = {
      ...state,
      profile,
      algorithm: { ...state.algorithm, planStartDate: profile.planStartDate },
      knowledge: { ...state.knowledge, planStartDate: profile.planStartDate },
    };
    this.writeState(candidate);
    return profile;
  }
}

let localDatabase: LocalTrainingDatabase | undefined;

export function getLocalTrainingDatabase() {
  if (!localDatabase) {
    const configured = process.env.LOCAL_DATABASE_PATH ?? ".offerpilot/offerpilot.sqlite";
    const path = isAbsolute(configured)
      ? configured
      : resolve(/* turbopackIgnore: true */ process.cwd(), configured);
    localDatabase = new LocalTrainingDatabase(path);
  }
  return localDatabase;
}
