-- OfferPilot V1 initial schema
--
-- Seed content is intentionally not included in this migration.  The seed
-- script imports the static Hot100 snapshot and the complete knowledge
-- catalogue after applying this file.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles and static seed content
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Shanghai'
    constraint profiles_timezone_not_blank check (btrim(timezone) <> ''),
  plan_start_date date not null default current_date,
  daily_new_algorithm_count integer not null default 2
    constraint profiles_daily_new_algorithm_count_check
      check (daily_new_algorithm_count between 0 and 100),
  daily_review_algorithm_count integer not null default 1
    constraint profiles_daily_review_algorithm_count_check
      check (daily_review_algorithm_count between 0 and 100),
  daily_new_knowledge_count integer not null default 3
    constraint profiles_daily_new_knowledge_count_check
      check (daily_new_knowledge_count between 0 and 100),
  daily_review_knowledge_count integer not null default 3
    constraint profiles_daily_review_knowledge_count_check
      check (daily_review_knowledge_count between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.algorithm_problems (
  id uuid primary key default gen_random_uuid(),
  leetcode_id integer not null unique,
  title text not null,
  title_en text,
  difficulty text not null
    constraint algorithm_problems_difficulty_check
      check (lower(difficulty) in ('easy', 'medium', 'hard')),
  url text not null,
  tags jsonb not null default '[]'::jsonb
    constraint algorithm_problems_tags_array_check
      check (jsonb_typeof(tags) = 'array'),
  recommended_week integer not null
    constraint algorithm_problems_recommended_week_check
      check (recommended_week between 1 and 6),
  importance integer not null default 3
    constraint algorithm_problems_importance_check
      check (importance between 1 and 5),
  order_index integer not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  importance integer not null default 3
    constraint knowledge_topics_importance_check
      check (importance between 1 and 5),
  -- The catalogue does not carry this field; the seed derives it from the
  -- agreed six-week category allocation.  It remains nullable for topics
  -- outside the core plan.
  recommended_week integer
    constraint knowledge_topics_recommended_week_check
      check (recommended_week between 1 and 6),
  question_count integer not null default 0
    constraint knowledge_topics_question_count_check
      check (question_count >= 0),
  main_question_count integer not null default 0
    constraint knowledge_topics_main_question_count_check
      check (main_question_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Algorithm training
-- ---------------------------------------------------------------------------

create table public.algorithm_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  problem_id uuid not null references public.algorithm_problems (id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds integer
    constraint algorithm_attempts_duration_check
      check (duration_seconds is null or duration_seconds >= 0),
  result text
    constraint algorithm_attempts_result_check
      check (result is null or result in ('first_ac', 'wa_then_ac', 'failed')),
  independence text
    constraint algorithm_attempts_independence_check
      check (independence is null or independence in
        ('independent', 'small_hint', 'solution_hint', 'full_solution')),
  -- The value 3 represents the UI choice "3+".
  wa_count integer not null default 0
    constraint algorithm_attempts_wa_count_check
      check (wa_count between 0 and 3),
  mistake_tags jsonb not null default '[]'::jsonb
    constraint algorithm_attempts_mistake_tags_array_check
      check (jsonb_typeof(mistake_tags) = 'array'),
  code text,
  ai_analysis jsonb,
  attempt_score numeric(5, 2)
    constraint algorithm_attempts_attempt_score_check
      check (attempt_score is null or attempt_score between 0 and 100),
  mastery_before numeric(5, 2)
    constraint algorithm_attempts_mastery_before_check
      check (mastery_before is null or mastery_before between 0 and 100),
  mastery_after numeric(5, 2)
    constraint algorithm_attempts_mastery_after_check
      check (mastery_after is null or mastery_after between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint algorithm_attempts_finish_pair_check
    check (
      (finished_at is null and result is null)
      or (finished_at is not null and result is not null)
    ),
  constraint algorithm_attempts_finish_after_start_check
    check (finished_at is null or finished_at >= started_at)
);

create table public.user_algorithm_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  problem_id uuid not null references public.algorithm_problems (id) on delete cascade,
  mastery numeric(5, 2) not null default 0
    constraint user_algorithm_state_mastery_check
      check (mastery between 0 and 100),
  attempt_count integer not null default 0
    constraint user_algorithm_state_attempt_count_check
      check (attempt_count >= 0),
  last_attempt_at timestamptz,
  next_review_at timestamptz,
  status text not null default 'unlearned'
    constraint user_algorithm_state_status_check
      check (status in ('unlearned', 'learning', 'due', 'mastered')),
  last_result text
    constraint user_algorithm_state_last_result_check
      check (last_result is null or last_result in ('first_ac', 'wa_then_ac', 'failed')),
  independent_ac_count integer not null default 0
    constraint user_algorithm_state_independent_ac_count_check
      check (independent_ac_count >= 0),
  last_independent_ac_at timestamptz,
  -- Set once an independent AC has occurred with the configured spacing
  -- requirement (currently at least three days).  Keeping this evidence on
  -- state avoids treating a single first-pass AC as permanently mastered.
  spaced_independent_ac_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, problem_id)
);

-- ---------------------------------------------------------------------------
-- Knowledge catalogue and training
-- ---------------------------------------------------------------------------

create table public.knowledge_questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.knowledge_topics (id) on delete restrict,
  category text not null,
  section text,
  topic text not null,
  question text not null,
  question_original text,
  question_type text not null
    constraint knowledge_questions_question_type_check
      check (question_type in ('main', 'follow_up')),
  importance integer not null default 3
    constraint knowledge_questions_importance_check
      check (importance between 1 and 5),
  source_starred boolean not null default false,
  difficulty text not null default 'unknown'
    constraint knowledge_questions_difficulty_check
      check (lower(difficulty) in ('easy', 'medium', 'hard', 'unknown')),
  answer_status text not null default 'available'
    constraint knowledge_questions_answer_status_check
      check (answer_status in ('available', 'container_only')),
  short_answer text,
  interview_answer text,
  full_answer text,
  key_points jsonb not null default '[]'::jsonb
    constraint knowledge_questions_key_points_array_check
      check (jsonb_typeof(key_points) = 'array'),
  keyword_aliases jsonb not null default '{}'::jsonb
    constraint knowledge_questions_keyword_aliases_object_check
      check (jsonb_typeof(keyword_aliases) = 'object'),
  -- Object keys are indexes into key_points; e.g. {"0": 20, "1": 5}.
  -- An empty object means the seed has not supplied derived weights yet.
  key_point_weights jsonb not null default '{}'::jsonb
    constraint knowledge_questions_key_point_weights_object_check
      check (jsonb_typeof(key_point_weights) = 'object'),
  parent_question text,
  parent_id uuid,
  source_book text,
  source_section text,
  source_order integer
    constraint knowledge_questions_source_order_check
      check (source_order is null or source_order >= 0),
  normalized_question text,
  duplicate_source_count integer not null default 1
    constraint knowledge_questions_duplicate_source_count_check
      check (duplicate_source_count >= 1),
  sources jsonb not null default '[]'::jsonb
    constraint knowledge_questions_sources_array_check
      check (jsonb_typeof(sources) = 'array'),
  is_core_6weeks boolean not null default false,
  -- These two fields are present in the derived core JSON.  They are kept so
  -- importing the complete and core snapshots does not discard source data.
  scheduled boolean not null default false,
  core_followups jsonb not null default '[]'::jsonb
    constraint knowledge_questions_core_followups_array_check
      check (jsonb_typeof(core_followups) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_questions_parent_shape_check
    check (
      (question_type = 'main' and parent_id is null)
      or (question_type = 'follow_up' and parent_id is not null)
    ),
  constraint knowledge_questions_parent_question_fk
    foreign key (parent_id) references public.knowledge_questions (id)
      on delete restrict deferrable initially deferred
);

create table public.knowledge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.knowledge_questions (id) on delete restrict,
  mode text not null
    constraint knowledge_attempts_mode_check
      check (mode in ('learn', 'recall')),
  -- Learn ratings are stored as 1..4, in the same order as the four UI
  -- choices: completely unknown, somewhat understood, basically understood,
  -- and very familiar.
  self_rating smallint
    constraint knowledge_attempts_self_rating_check
      check (self_rating is null or self_rating between 1 and 4),
  answer_text text,
  coverage_score numeric(5, 2)
    constraint knowledge_attempts_coverage_score_check
      check (coverage_score is null or coverage_score between 0 and 100),
  matched_points jsonb not null default '[]'::jsonb
    constraint knowledge_attempts_matched_points_array_check
      check (jsonb_typeof(matched_points) = 'array'),
  missing_points jsonb not null default '[]'::jsonb
    constraint knowledge_attempts_missing_points_array_check
      check (jsonb_typeof(missing_points) = 'array'),
  mastery_before numeric(5, 2)
    constraint knowledge_attempts_mastery_before_check
      check (mastery_before is null or mastery_before between 0 and 100),
  mastery_after numeric(5, 2)
    constraint knowledge_attempts_mastery_after_check
      check (mastery_after is null or mastery_after between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_knowledge_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.knowledge_questions (id) on delete cascade,
  mastery numeric(5, 2) not null default 0
    constraint user_knowledge_state_mastery_check
      check (mastery between 0 and 100),
  attempt_count integer not null default 0
    constraint user_knowledge_state_attempt_count_check
      check (attempt_count >= 0),
  last_attempt_at timestamptz,
  next_review_at timestamptz,
  status text not null default 'unlearned'
    constraint user_knowledge_state_status_check
      check (status in ('unlearned', 'learning', 'due', 'mastered')),
  learn_count integer not null default 0
    constraint user_knowledge_state_learn_count_check
      check (learn_count >= 0),
  recall_count integer not null default 0
    constraint user_knowledge_state_recall_count_check
      check (recall_count >= 0),
  last_recall_at timestamptz,
  last_recall_coverage_score numeric(5, 2)
    constraint user_knowledge_state_last_recall_coverage_check
      check (
        last_recall_coverage_score is null
        or last_recall_coverage_score between 0 and 100
      ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Daily planner output
-- ---------------------------------------------------------------------------

create table public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_date date not null,
  task_type text not null
    constraint daily_tasks_task_type_check
      check (task_type in ('new', 'review', 'weakness')),
  reason text not null
    constraint daily_tasks_reason_not_blank_check
      check (btrim(reason) <> ''),
  status text not null default 'pending'
    constraint daily_tasks_status_check
      check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  algorithm_problem_id uuid references public.algorithm_problems (id) on delete restrict,
  knowledge_question_id uuid references public.knowledge_questions (id) on delete restrict,
  sort_order integer not null default 0
    constraint daily_tasks_sort_order_check
      check (sort_order >= 0),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    constraint daily_tasks_metadata_object_check
      check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_tasks_exactly_one_resource_check
    check ((algorithm_problem_id is not null) <> (knowledge_question_id is not null)),
  constraint daily_tasks_completed_at_check
    check (status <> 'completed' or completed_at is not null)
);

-- ---------------------------------------------------------------------------
-- Indexes and idempotency constraints
-- ---------------------------------------------------------------------------

-- At most one in-progress attempt exists for a user/problem.  Finished
-- attempts remain an append-only history and are intentionally not unique.
create unique index algorithm_attempts_one_open_per_problem_uidx
  on public.algorithm_attempts (user_id, problem_id)
  where finished_at is null;

create index algorithm_attempts_user_problem_created_idx
  on public.algorithm_attempts (user_id, problem_id, created_at desc);

create index user_algorithm_state_next_review_idx
  on public.user_algorithm_state (user_id, next_review_at)
  where next_review_at is not null;

create index knowledge_questions_topic_idx
  on public.knowledge_questions (topic_id, question_type, importance desc);

create index knowledge_questions_core_main_idx
  on public.knowledge_questions (topic_id, importance desc, id)
  where is_core_6weeks = true and question_type = 'main';

create index knowledge_attempts_user_question_created_idx
  on public.knowledge_attempts (user_id, question_id, created_at desc);

create index user_knowledge_state_next_review_idx
  on public.user_knowledge_state (user_id, next_review_at)
  where next_review_at is not null;

create index daily_tasks_user_date_status_idx
  on public.daily_tasks (user_id, task_date, status, sort_order);

-- Separate partial indexes are deliberate: a task has exactly one resource,
-- so the appropriate index prevents same-user/same-day/same-resource
-- duplicates while allowing algorithm and knowledge ids to overlap.
create unique index daily_tasks_user_date_algorithm_uidx
  on public.daily_tasks (user_id, task_date, algorithm_problem_id)
  where algorithm_problem_id is not null;

create unique index daily_tasks_user_date_knowledge_uidx
  on public.daily_tasks (user_id, task_date, knowledge_question_id)
  where knowledge_question_id is not null;

-- ---------------------------------------------------------------------------
-- Timestamp and auth triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger algorithm_problems_set_updated_at
  before update on public.algorithm_problems
  for each row execute function public.set_updated_at();

create trigger algorithm_attempts_set_updated_at
  before update on public.algorithm_attempts
  for each row execute function public.set_updated_at();

create trigger user_algorithm_state_set_updated_at
  before update on public.user_algorithm_state
  for each row execute function public.set_updated_at();

create trigger knowledge_topics_set_updated_at
  before update on public.knowledge_topics
  for each row execute function public.set_updated_at();

create trigger knowledge_questions_set_updated_at
  before update on public.knowledge_questions
  for each row execute function public.set_updated_at();

create trigger knowledge_attempts_set_updated_at
  before update on public.knowledge_attempts
  for each row execute function public.set_updated_at();

create trigger user_knowledge_state_set_updated_at
  before update on public.user_knowledge_state
  for each row execute function public.set_updated_at();

create trigger daily_tasks_set_updated_at
  before update on public.daily_tasks
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.algorithm_problems enable row level security;
alter table public.algorithm_attempts enable row level security;
alter table public.user_algorithm_state enable row level security;
alter table public.knowledge_topics enable row level security;
alter table public.knowledge_questions enable row level security;
alter table public.knowledge_attempts enable row level security;
alter table public.user_knowledge_state enable row level security;
alter table public.daily_tasks enable row level security;

create policy profiles_own_rows
  on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy algorithm_problems_authenticated_read
  on public.algorithm_problems
  for select to authenticated
  using (true);

create policy algorithm_attempts_own_rows
  on public.algorithm_attempts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_algorithm_state_own_rows
  on public.user_algorithm_state
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy knowledge_topics_authenticated_read
  on public.knowledge_topics
  for select to authenticated
  using (true);

create policy knowledge_questions_authenticated_read
  on public.knowledge_questions
  for select to authenticated
  using (true);

create policy knowledge_attempts_own_rows
  on public.knowledge_attempts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_knowledge_state_own_rows
  on public.user_knowledge_state
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy daily_tasks_own_rows
  on public.daily_tasks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Supabase commonly installs these grants as defaults, but keeping them
-- explicit makes the migration safe when applied to a fresh project.
grant usage on schema public to authenticated;
grant select on public.algorithm_problems, public.knowledge_topics,
  public.knowledge_questions to authenticated;
grant select, insert, update, delete on public.profiles,
  public.algorithm_attempts, public.user_algorithm_state,
  public.knowledge_attempts, public.user_knowledge_state,
  public.daily_tasks to authenticated;

comment on column public.algorithm_attempts.wa_count is
  '0, 1, 2, or 3, where 3 represents the UI choice 3+.';

comment on column public.knowledge_questions.key_point_weights is
  'JSON object keyed by zero-based key_points index; core conclusion defaults to 20 and other points to 5 in seed.';

comment on column public.user_algorithm_state.spaced_independent_ac_at is
  'Evidence timestamp for at least one independent AC after the configured spaced interval.';

comment on column public.user_knowledge_state.recall_count is
  'Number of submitted recall attempts; this is the evidence required for knowledge mastery.';

commit;
