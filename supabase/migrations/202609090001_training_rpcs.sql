begin;

create or replace function public.start_algorithm_training_attempt(
  p_attempt_id uuid,
  p_problem_id uuid,
  p_started_at timestamptz,
  p_task_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.algorithm_attempts%rowtype;
  v_resumed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.algorithm_attempts
  where user_id = v_user_id
    and problem_id = p_problem_id
    and finished_at is null
  for update;

  if found then
    v_resumed := true;
  else
    begin
      insert into public.algorithm_attempts (
        id, user_id, problem_id, started_at
      ) values (
        p_attempt_id, v_user_id, p_problem_id, p_started_at
      )
      returning * into v_attempt;
    exception when unique_violation then
      select * into strict v_attempt
      from public.algorithm_attempts
      where user_id = v_user_id
        and problem_id = p_problem_id
        and finished_at is null
      for update;
      v_resumed := true;
    end;
  end if;

  update public.daily_tasks
  set status = 'in_progress', completed_at = null
  where user_id = v_user_id
    and task_date = p_task_date
    and algorithm_problem_id = p_problem_id
    and status = 'pending';

  return jsonb_build_object(
    'id', v_attempt.id,
    'started_at', v_attempt.started_at,
    'resumed', v_resumed
  );
end;
$$;

create or replace function public.complete_algorithm_training_attempt(
  p_attempt_id uuid,
  p_problem_id uuid,
  p_finished_at timestamptz,
  p_duration_seconds integer,
  p_result text,
  p_independence text,
  p_wa_count integer,
  p_mistake_tags jsonb,
  p_code text,
  p_ai_analysis jsonb,
  p_attempt_score numeric,
  p_mastery_before numeric,
  p_mastery_after numeric,
  p_state_mastery numeric,
  p_state_attempt_count integer,
  p_state_next_review_at timestamptz,
  p_state_status text,
  p_state_last_result text,
  p_state_independent_ac_count integer,
  p_state_last_independent_ac_at timestamptz,
  p_state_spaced_independent_ac_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.algorithm_attempts
  set
    finished_at = p_finished_at,
    duration_seconds = p_duration_seconds,
    result = p_result,
    independence = p_independence,
    wa_count = p_wa_count,
    mistake_tags = p_mistake_tags,
    code = p_code,
    ai_analysis = p_ai_analysis,
    attempt_score = p_attempt_score,
    mastery_before = p_mastery_before,
    mastery_after = p_mastery_after
  where id = p_attempt_id
    and user_id = v_user_id
    and problem_id = p_problem_id
    and finished_at is null;

  if not found then
    raise exception 'Open algorithm attempt not found' using errcode = 'P0002';
  end if;

  insert into public.user_algorithm_state (
    user_id,
    problem_id,
    mastery,
    attempt_count,
    last_attempt_at,
    next_review_at,
    status,
    last_result,
    independent_ac_count,
    last_independent_ac_at,
    spaced_independent_ac_at
  )
  values (
    v_user_id,
    p_problem_id,
    p_state_mastery,
    p_state_attempt_count,
    p_finished_at,
    p_state_next_review_at,
    p_state_status,
    p_state_last_result,
    p_state_independent_ac_count,
    p_state_last_independent_ac_at,
    p_state_spaced_independent_ac_at
  )
  on conflict (user_id, problem_id) do update
  set
    mastery = excluded.mastery,
    attempt_count = excluded.attempt_count,
    last_attempt_at = excluded.last_attempt_at,
    next_review_at = excluded.next_review_at,
    status = excluded.status,
    last_result = excluded.last_result,
    independent_ac_count = excluded.independent_ac_count,
    last_independent_ac_at = excluded.last_independent_ac_at,
    spaced_independent_ac_at = excluded.spaced_independent_ac_at;

  update public.daily_tasks
  set status = 'completed', completed_at = p_finished_at
  where user_id = v_user_id
    and algorithm_problem_id = p_problem_id
    and status in ('pending', 'in_progress');
end;
$$;

create or replace function public.record_knowledge_training_attempt(
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
  p_expected_attempt_count integer
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

revoke execute on function public.start_algorithm_training_attempt(
  uuid, uuid, timestamptz, date
) from public;
revoke execute on function public.complete_algorithm_training_attempt(
  uuid, uuid, timestamptz, integer, text, text, integer, jsonb, text, jsonb,
  numeric, numeric, numeric, numeric, integer, timestamptz, text, text,
  integer, timestamptz, timestamptz
) from public;
revoke execute on function public.record_knowledge_training_attempt(
  uuid, uuid, text, integer, text, numeric, jsonb, jsonb, numeric, numeric,
  timestamptz, numeric, integer, timestamptz, text, integer, integer,
  timestamptz, numeric, integer
) from public;

grant execute on function public.start_algorithm_training_attempt(
  uuid, uuid, timestamptz, date
) to authenticated;
grant execute on function public.complete_algorithm_training_attempt(
  uuid, uuid, timestamptz, integer, text, text, integer, jsonb, text, jsonb,
  numeric, numeric, numeric, numeric, integer, timestamptz, text, text,
  integer, timestamptz, timestamptz
) to authenticated;
grant execute on function public.record_knowledge_training_attempt(
  uuid, uuid, text, integer, text, numeric, jsonb, jsonb, numeric, numeric,
  timestamptz, numeric, integer, timestamptz, text, integer, integer,
  timestamptz, numeric, integer
) to authenticated;

commit;
