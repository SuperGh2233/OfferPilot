begin;

-- Each range is [start, end) in the profile's 03:00 training-day calendar.
-- An open end means the user has manually paused their plan.
alter table public.profiles
  add column pause_periods jsonb not null default '[]'::jsonb
  constraint profiles_pause_periods_array check (jsonb_typeof(pause_periods) = 'array');

-- The profile is locked to make simultaneous pause/resume requests idempotent.
-- Training records and existing daily tasks are deliberately never deleted.
create function public.set_plan_paused(p_paused boolean)
returns public.profiles
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_day date;
  v_last jsonb;
  v_days integer;
begin
  if auth.uid() is null or p_paused is null then
    raise exception 'Authenticated pause state is required' using errcode = '42501';
  end if;
  select * into v_profile from public.profiles
    where id = auth.uid() for update;
  if not found then
    raise exception 'Profile must be initialized before pausing' using errcode = 'P0002';
  end if;
  v_day := (now() at time zone v_profile.timezone)::date;
  if extract(hour from now() at time zone v_profile.timezone) < 3 then
    v_day := v_day - 1;
  end if;
  v_last := v_profile.pause_periods -> (jsonb_array_length(v_profile.pause_periods) - 1);
  if p_paused = (v_last is not null and v_last -> 'end' = 'null'::jsonb) then
    return v_profile;
  end if;

  if p_paused then
    if jsonb_array_length(v_profile.pause_periods) >= 500 then
      raise exception 'Pause history limit reached' using errcode = '22023';
    end if;
    update public.profiles set
      pause_periods = pause_periods || jsonb_build_array(jsonb_build_object('start', v_day::text, 'end', null)),
      updated_at = now()
    where id = v_profile.id returning * into v_profile;
  else
    if v_day < (v_last ->> 'start')::date then
      raise exception 'Resume day precedes pause day' using errcode = '22023';
    end if;
    v_days := v_day - (v_last ->> 'start')::date;
    -- Old reviews already overdue before the pause are left untouched.
    -- Reviews due during the break move forward by the full paused days.
    if v_days > 0 then
      update public.user_algorithm_state
        set next_review_at = next_review_at + make_interval(days => v_days),
            status = case when status = 'due'
              and next_review_at + make_interval(days => v_days) > now()
              then 'learning' else status end
        where user_id = v_profile.id
          and next_review_at >= (((v_last ->> 'start')::date + time '03:00') at time zone v_profile.timezone)
          and (last_attempt_at is null or last_attempt_at < (((v_last ->> 'start')::date + time '03:00') at time zone v_profile.timezone));
      update public.user_knowledge_state
        set next_review_at = next_review_at + make_interval(days => v_days),
            status = case when status = 'due'
              and next_review_at + make_interval(days => v_days) > now()
              then 'learning' else status end
        where user_id = v_profile.id
          and next_review_at >= (((v_last ->> 'start')::date + time '03:00') at time zone v_profile.timezone)
          and (last_attempt_at is null or last_attempt_at < (((v_last ->> 'start')::date + time '03:00') at time zone v_profile.timezone));
    end if;
    update public.profiles set
      pause_periods = jsonb_set(pause_periods,
        array[(jsonb_array_length(pause_periods) - 1)::text, 'end'], to_jsonb(v_day::text)),
      updated_at = now()
    where id = v_profile.id returning * into v_profile;
  end if;
  return v_profile;
end;
$$;

revoke execute on function public.set_plan_paused(boolean) from public;
grant execute on function public.set_plan_paused(boolean) to authenticated;

commit;
