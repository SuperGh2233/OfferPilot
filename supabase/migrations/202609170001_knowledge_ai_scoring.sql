begin;

-- 八股 Recall 计分改为 AI 主导、确定性为下界。
--
--   effective_coverage_score = max(coverage_score, ai_analysis.semanticScore)
--
-- coverage_score 保持不变，继续记录确定性加权覆盖率；新增的
-- effective_coverage_score 记录当次实际计入 mastery 的覆盖率，这样
-- 即使以后调整公式，历史记录仍然可审计、可复现。
-- 旧行两列均为 null，读取时回退为 coverage_score，因此不做历史回填。

alter table public.knowledge_attempts
  add column if not exists ai_analysis jsonb,
  add column if not exists effective_coverage_score numeric(5, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'knowledge_attempts_effective_coverage_score_check'
      and conrelid = 'public.knowledge_attempts'::regclass
  ) then
    alter table public.knowledge_attempts
      add constraint knowledge_attempts_effective_coverage_score_check
        check (effective_coverage_score is null or effective_coverage_score between 0 and 100);
  end if;
end
$$;

-- 参数列表变化必须显式 drop，否则 create or replace 会留下旧重载，
-- 导致 PostgREST 在调用时无法确定目标函数。
drop function if exists public.record_knowledge_training_attempt(
  uuid, uuid, text, integer, text, numeric, jsonb, jsonb, numeric, numeric,
  timestamptz, numeric, integer, timestamptz, text, integer, integer,
  timestamptz, numeric, integer
);

-- 原有 20 个参数保持顺序与名字不变，两个新参数追加在末尾并给默认值。
-- 这样迁移对旧版本前端仍然可用（新参数取 null），
-- 避免"迁移已应用但代码还没上线"这段窗口期打挂训练提交。
create function public.record_knowledge_training_attempt(
  p_attempt_id uuid,
  p_question_id uuid,
  p_mode text,
  p_self_rating integer,
  p_answer_text text,
  p_coverage_score numeric,
  p_matched_points jsonb,
  p_missing_points jsonb,
  p_mastery_before numeric,
  p_mastery_after numeric,
  p_attempted_at timestamptz,
  p_state_mastery numeric,
  p_state_attempt_count integer,
  p_state_next_review_at timestamptz,
  p_state_status text,
  p_state_learn_count integer,
  p_state_recall_count integer,
  p_state_last_recall_at timestamptz,
  p_state_last_recall_coverage_score numeric,
  p_expected_attempt_count integer,
  p_effective_coverage_score numeric default null,
  p_ai_analysis jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_attempt_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_question_id::text, 0)
  );
  select attempt_count into v_current_attempt_count
  from public.user_knowledge_state
  where user_id = v_user_id and question_id = p_question_id;
  v_current_attempt_count := coalesce(v_current_attempt_count, 0);
  if v_current_attempt_count <> p_expected_attempt_count then
    raise exception 'Knowledge state changed; reload before submitting again'
      using errcode = '40001';
  end if;

  insert into public.knowledge_attempts (
    id,
    user_id,
    question_id,
    mode,
    self_rating,
    answer_text,
    coverage_score,
    effective_coverage_score,
    ai_analysis,
    matched_points,
    missing_points,
    mastery_before,
    mastery_after,
    created_at
  )
  values (
    p_attempt_id,
    v_user_id,
    p_question_id,
    p_mode,
    p_self_rating,
    p_answer_text,
    p_coverage_score,
    p_effective_coverage_score,
    p_ai_analysis,
    p_matched_points,
    p_missing_points,
    p_mastery_before,
    p_mastery_after,
    p_attempted_at
  );

  insert into public.user_knowledge_state (
    user_id,
    question_id,
    mastery,
    attempt_count,
    last_attempt_at,
    next_review_at,
    status,
    learn_count,
    recall_count,
    last_recall_at,
    last_recall_coverage_score
  )
  values (
    v_user_id,
    p_question_id,
    p_state_mastery,
    p_state_attempt_count,
    p_attempted_at,
    p_state_next_review_at,
    p_state_status,
    p_state_learn_count,
    p_state_recall_count,
    p_state_last_recall_at,
    p_state_last_recall_coverage_score
  )
  on conflict (user_id, question_id) do update
  set
    mastery = excluded.mastery,
    attempt_count = excluded.attempt_count,
    last_attempt_at = excluded.last_attempt_at,
    next_review_at = excluded.next_review_at,
    status = excluded.status,
    learn_count = excluded.learn_count,
    recall_count = excluded.recall_count,
    last_recall_at = excluded.last_recall_at,
    last_recall_coverage_score = excluded.last_recall_coverage_score;

  update public.daily_tasks
  set status = 'completed', completed_at = p_attempted_at
  where user_id = v_user_id
    and knowledge_question_id = p_question_id
    and status in ('pending', 'in_progress');
end;
$$;

revoke execute on function public.record_knowledge_training_attempt(
  uuid, uuid, text, integer, text, numeric, jsonb, jsonb, numeric, numeric,
  timestamptz, numeric, integer, timestamptz, text, integer, integer,
  timestamptz, numeric, integer, numeric, jsonb
) from public;

grant execute on function public.record_knowledge_training_attempt(
  uuid, uuid, text, integer, text, numeric, jsonb, jsonb, numeric, numeric,
  timestamptz, numeric, integer, timestamptz, text, integer, integer,
  timestamptz, numeric, integer, numeric, jsonb
) to authenticated;

commit;
