export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Insert<Row, Required extends keyof Row> = Partial<Row> & Pick<Row, Required>;
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Insert<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Profile = {
  id: string;
  display_name: string | null;
  timezone: string;
  plan_start_date: string;
  daily_new_algorithm_count: number;
  daily_review_algorithm_count: number;
  daily_new_knowledge_count: number;
  daily_review_knowledge_count: number;
  created_at: string;
  updated_at: string;
};

export type AlgorithmProblem = {
  id: string;
  leetcode_id: number;
  title: string;
  title_en: string | null;
  difficulty: "easy" | "medium" | "hard";
  url: string;
  tags: Json;
  recommended_week: number;
  importance: number;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type AlgorithmAttempt = {
  id: string;
  user_id: string;
  problem_id: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  result: "first_ac" | "wa_then_ac" | "failed" | null;
  independence: "independent" | "small_hint" | "solution_hint" | "full_solution" | null;
  wa_count: number;
  mistake_tags: Json;
  code: string | null;
  ai_analysis: Json | null;
  attempt_score: number | null;
  mastery_before: number | null;
  mastery_after: number | null;
  created_at: string;
  updated_at: string;
};

export type UserAlgorithmState = {
  user_id: string;
  problem_id: string;
  mastery: number;
  attempt_count: number;
  last_attempt_at: string | null;
  next_review_at: string | null;
  status: "unlearned" | "learning" | "due" | "mastered";
  last_result: "first_ac" | "wa_then_ac" | "failed" | null;
  independent_ac_count: number;
  last_independent_ac_at: string | null;
  spaced_independent_ac_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeTopic = {
  id: string;
  name: string;
  category: string;
  importance: number;
  recommended_week: number | null;
  question_count: number;
  main_question_count: number;
  created_at: string;
  updated_at: string;
};

export type KnowledgeQuestion = {
  id: string;
  topic_id: string;
  category: string;
  section: string | null;
  topic: string;
  question: string;
  question_original: string | null;
  question_type: "main" | "follow_up";
  importance: number;
  source_starred: boolean;
  difficulty: "easy" | "medium" | "hard" | "unknown";
  answer_status: "available" | "container_only";
  short_answer: string | null;
  interview_answer: string | null;
  full_answer: string | null;
  key_points: Json;
  keyword_aliases: Json;
  key_point_weights: Json;
  parent_question: string | null;
  parent_id: string | null;
  source_book: string | null;
  source_section: string | null;
  source_order: number | null;
  normalized_question: string | null;
  duplicate_source_count: number;
  sources: Json;
  is_core_6weeks: boolean;
  scheduled: boolean;
  core_followups: Json;
  created_at: string;
  updated_at: string;
};

export type KnowledgeAttempt = {
  id: string;
  user_id: string;
  question_id: string;
  mode: "learn" | "recall";
  self_rating: number | null;
  answer_text: string | null;
  coverage_score: number | null;
  effective_coverage_score: number | null;
  ai_analysis: Json | null;
  matched_points: Json;
  missing_points: Json;
  mastery_before: number | null;
  mastery_after: number | null;
  created_at: string;
  updated_at: string;
};

export type UserKnowledgeState = {
  user_id: string;
  question_id: string;
  mastery: number;
  attempt_count: number;
  last_attempt_at: string | null;
  next_review_at: string | null;
  status: "unlearned" | "learning" | "due" | "mastered";
  learn_count: number;
  recall_count: number;
  last_recall_at: string | null;
  last_recall_coverage_score: number | null;
  created_at: string;
  updated_at: string;
};

export type DailyTask = {
  id: string;
  user_id: string;
  task_date: string;
  task_type: "new" | "review" | "weakness";
  reason: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  algorithm_problem_id: string | null;
  knowledge_question_id: string | null;
  sort_order: number;
  completed_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile, "id">;
      algorithm_problems: Table<
        AlgorithmProblem,
        "leetcode_id" | "title" | "difficulty" | "url" | "recommended_week" | "order_index"
      >;
      algorithm_attempts: Table<AlgorithmAttempt, "user_id" | "problem_id">;
      user_algorithm_state: Table<UserAlgorithmState, "user_id" | "problem_id">;
      knowledge_topics: Table<KnowledgeTopic, "name" | "category">;
      knowledge_questions: Table<
        KnowledgeQuestion,
        "topic_id" | "category" | "topic" | "question" | "question_type"
      >;
      knowledge_attempts: Table<KnowledgeAttempt, "user_id" | "question_id" | "mode">;
      user_knowledge_state: Table<UserKnowledgeState, "user_id" | "question_id">;
      daily_tasks: Table<DailyTask, "user_id" | "task_date" | "task_type" | "reason">;
    };
    Views: Record<string, never>;
    Functions: {
      start_algorithm_training_attempt: {
        Args: {
          p_attempt_id: string;
          p_problem_id: string;
          p_started_at: string;
          p_task_date: string;
        };
        Returns: Json;
      };
      complete_algorithm_training_attempt: {
        Args: {
          p_ai_analysis: Json | null;
          p_attempt_id: string;
          p_attempt_score: number;
          p_code: string | null;
          p_duration_seconds: number;
          p_finished_at: string;
          p_independence: AlgorithmAttempt["independence"];
          p_mastery_after: number;
          p_mastery_before: number | null;
          p_mistake_tags: Json;
          p_problem_id: string;
          p_result: AlgorithmAttempt["result"];
          p_state_attempt_count: number;
          p_state_independent_ac_count: number;
          p_state_last_independent_ac_at: string | null;
          p_state_last_result: UserAlgorithmState["last_result"];
          p_state_mastery: number;
          p_state_next_review_at: string;
          p_state_spaced_independent_ac_at: string | null;
          p_state_status: UserAlgorithmState["status"];
          p_wa_count: number;
        };
        Returns: undefined;
      };
      record_knowledge_training_attempt: {
        Args: {
          p_answer_text: string | null;
          p_attempt_id: string;
          p_attempted_at: string;
          p_coverage_score: number | null;
          p_effective_coverage_score: number | null;
          p_ai_analysis: Json | null;
          p_expected_attempt_count: number;
          p_mastery_after: number;
          p_mastery_before: number | null;
          p_matched_points: Json;
          p_missing_points: Json;
          p_mode: KnowledgeAttempt["mode"];
          p_question_id: string;
          p_self_rating: number | null;
          p_state_attempt_count: number;
          p_state_last_recall_at: string | null;
          p_state_last_recall_coverage_score: number | null;
          p_state_learn_count: number;
          p_state_mastery: number;
          p_state_next_review_at: string;
          p_state_recall_count: number;
          p_state_status: UserKnowledgeState["status"];
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
