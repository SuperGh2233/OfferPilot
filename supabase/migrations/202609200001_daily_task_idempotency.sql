begin;

-- The planner runs in TypeScript. This RPC atomically persists each day's
-- algorithm/knowledge assignment exactly once, even if two snapshots were
-- calculated against the same initially empty day. Return rows as ONE JSON
-- array so PostgREST max_rows cannot silently truncate a large backfill.
create function public.ensure_daily_training_tasks(p_tasks jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_group record;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_tasks) is distinct from 'array'
     or jsonb_array_length(p_tasks) = 0
     or jsonb_array_length(p_tasks) > 1000 then
    raise exception 'p_tasks must contain 1 to 1000 task objects' using errcode = '22023';
  end if;

  -- Lock each date and resource class for the lifetime of the transaction.
  -- Sort groups so concurrent callers acquire locks in the same order.
  for v_group in
    select distinct task_date, resource_class
    from (
      select task_date,
        case when algorithm_problem_id is not null then 'algorithm' else 'knowledge' end as resource_class
      from jsonb_to_recordset(p_tasks) as input(
        task_date date, algorithm_problem_id uuid, knowledge_question_id uuid
      )
    ) as groups
    order by task_date, resource_class
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      v_user_id::text || ':' || v_group.task_date::text || ':' || v_group.resource_class, 0
    ));

    -- The first caller owns the complete assignment for this day/class.
    -- Another caller must read that committed assignment rather than add a
    -- second, possibly different, set of problems or reorder existing tasks.
    if not exists (
      select 1 from public.daily_tasks existing
      where existing.user_id = v_user_id
        and existing.task_date = v_group.task_date
        and ((v_group.resource_class = 'algorithm' and existing.algorithm_problem_id is not null)
          or (v_group.resource_class = 'knowledge' and existing.knowledge_question_id is not null))
    ) then
      insert into public.daily_tasks (
        user_id, task_date, task_type, reason, status,
        algorithm_problem_id, knowledge_question_id,
        sort_order, completed_at, metadata
      )
      select
        v_user_id, input.task_date, input.task_type, input.reason, input.status,
        input.algorithm_problem_id, input.knowledge_question_id,
        input.sort_order, input.completed_at, coalesce(input.metadata, '{}'::jsonb)
      from jsonb_to_recordset(p_tasks) as input(
        task_date date, task_type text, reason text, status text,
        algorithm_problem_id uuid, knowledge_question_id uuid,
        sort_order integer, completed_at timestamptz, metadata jsonb
      )
      where input.task_date = v_group.task_date
        and ((v_group.resource_class = 'algorithm' and input.algorithm_problem_id is not null)
          or (v_group.resource_class = 'knowledge' and input.knowledge_question_id is not null))
      on conflict do nothing;
    end if;
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

revoke execute on function public.ensure_daily_training_tasks(jsonb) from public;
grant execute on function public.ensure_daily_training_tasks(jsonb) to authenticated;

commit;
