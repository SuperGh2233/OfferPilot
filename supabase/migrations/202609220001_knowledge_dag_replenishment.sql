begin;

-- Knowledge Graph Sprint 2 may initially generate fewer new tasks when
-- prerequisites are locked. Once a prerequisite is learned on the same day,
-- append only the newly-unlocked tasks to the already-existing Knowledge
-- bucket. Initial assignment still uses ensure_daily_training_tasks(jsonb).
create function public.append_knowledge_training_tasks(p_tasks jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_group record;
  v_max_sort integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_tasks) is distinct from 'array'
     or jsonb_array_length(p_tasks) = 0
     or jsonb_array_length(p_tasks) > 1000 then
    raise exception 'p_tasks must contain 1 to 1000 task objects' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_tasks) as input(
      task_date date,
      status text,
      algorithm_problem_id uuid,
      knowledge_question_id uuid
    )
    where input.task_date is null
      or input.algorithm_problem_id is not null
      or input.knowledge_question_id is null
      or input.status is distinct from 'pending'
  ) then
    raise exception 'append_knowledge_training_tasks accepts pending Knowledge tasks only'
      using errcode = '22023';
  end if;

  for v_group in
    select distinct input.task_date
    from jsonb_to_recordset(p_tasks) as input(task_date date)
    order by input.task_date
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      v_user_id::text || ':' || v_group.task_date::text || ':knowledge', 0
    ));

    if not exists (
      select 1
      from public.daily_tasks existing
      where existing.user_id = v_user_id
        and existing.task_date = v_group.task_date
        and existing.knowledge_question_id is not null
    ) then
      raise exception 'Knowledge task bucket does not exist for %', v_group.task_date
        using errcode = 'P0002';
    end if;

    select coalesce(max(existing.sort_order), -1)
      into v_max_sort
    from public.daily_tasks existing
    where existing.user_id = v_user_id
      and existing.task_date = v_group.task_date
      and existing.knowledge_question_id is not null;

    insert into public.daily_tasks (
      user_id,
      task_date,
      task_type,
      reason,
      status,
      algorithm_problem_id,
      knowledge_question_id,
      sort_order,
      completed_at,
      metadata
    )
    select
      v_user_id,
      input.task_date,
      input.task_type,
      input.reason,
      input.status,
      null,
      input.knowledge_question_id,
      v_max_sort + row_number() over (
        order by input.sort_order, input.knowledge_question_id
      ),
      null,
      coalesce(input.metadata, '{}'::jsonb)
    from jsonb_to_recordset(p_tasks) as input(
      task_date date,
      task_type text,
      reason text,
      status text,
      algorithm_problem_id uuid,
      knowledge_question_id uuid,
      sort_order integer,
      completed_at timestamptz,
      metadata jsonb
    )
    where input.task_date = v_group.task_date
    on conflict do nothing;
  end loop;

  return coalesce((
    select jsonb_agg(to_jsonb(stored) order by stored.task_date, stored.sort_order, stored.id)
    from public.daily_tasks stored
    where stored.user_id = v_user_id
      and stored.task_date in (
        select distinct input.task_date
        from jsonb_to_recordset(p_tasks) as input(task_date date)
      )
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.append_knowledge_training_tasks(jsonb) from public;
grant execute on function public.append_knowledge_training_tasks(jsonb) to authenticated;

commit;
