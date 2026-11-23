-- =====================================================================
-- Відпочинок МІЖ ВПРАВАМИ (перехідний відпочинок).
--   program_exercises.transition_rest_seconds — власне значення для вправи
--     (null = авто: 5:00 після базової, 3:00 після ізолюючої);
--   profiles.transition_rest_enabled — перемикач у Settings;
--   save_program і clone_program зберігають / копіюють нове поле.
-- Ідемпотентна: можна запускати повторно.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Колонки
-- ---------------------------------------------------------------------
alter table public.program_exercises
  add column if not exists transition_rest_seconds integer;

alter table public.program_exercises
  drop constraint if exists program_exercises_transition_rest_seconds_check;
alter table public.program_exercises
  add constraint program_exercises_transition_rest_seconds_check
  check (transition_rest_seconds is null or transition_rest_seconds between 0 and 900);

alter table public.profiles
  add column if not exists transition_rest_enabled boolean not null default true;

-- ---------------------------------------------------------------------
-- 2. save_program — як у 20261118000001_save_program.sql, плюс
--    transition_rest_seconds (відсутній ключ або null → авто).
-- ---------------------------------------------------------------------
create or replace function public.save_program(p_program_id uuid, p_payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid         uuid := auth.uid();
  v_days      jsonb := p_payload -> 'days';
  v_name      text := btrim(p_payload ->> 'name');
  v_day       jsonb;
  v_day_id    uuid;
  v_day_pos   int := 0;
  v_ex        jsonb;
  v_ex_pos    int;
  v_ex_id     uuid;
  v_keep_days uuid[];
  v_keep_ex   uuid[];
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if v_days is null or jsonb_typeof(v_days) <> 'array'
     or jsonb_array_length(v_days) not between 1 and 7 then
    raise exception 'A program needs 1 to 7 days' using errcode = '22023';
  end if;

  update public.programs
     set name = v_name,
         days_per_week = jsonb_array_length(v_days)
   where id = p_program_id and owner_id = uid;
  if not found then
    raise exception 'Program not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg((d ->> 'id')::uuid), '{}')
    into v_keep_days
    from jsonb_array_elements(v_days) d
   where d ->> 'id' is not null;

  if exists (
    select 1 from unnest(v_keep_days) k
     where not exists (select 1 from public.program_days pd
                        where pd.id = k and pd.program_id = p_program_id)
  ) then
    raise exception 'Unknown program day' using errcode = '22023';
  end if;

  delete from public.program_days
   where program_id = p_program_id
     and not (id = any (v_keep_days));

  update public.program_days
     set position = position + 1000
   where program_id = p_program_id;

  for v_day in select value from jsonb_array_elements(v_days)
  loop
    if v_day ->> 'id' is null then
      insert into public.program_days (program_id, name, position)
      values (p_program_id, btrim(v_day ->> 'name'), v_day_pos)
      returning id into v_day_id;
    else
      v_day_id := (v_day ->> 'id')::uuid;
      update public.program_days
         set name = btrim(v_day ->> 'name'), position = v_day_pos
       where id = v_day_id;
    end if;

    if jsonb_typeof(v_day -> 'exercises') <> 'array'
       or jsonb_array_length(v_day -> 'exercises') = 0 then
      raise exception 'Every day needs at least one exercise' using errcode = '22023';
    end if;

    if (select count(*) from jsonb_array_elements(v_day -> 'exercises'))
       <> (select count(distinct e ->> 'exercise_id') from jsonb_array_elements(v_day -> 'exercises') e) then
      raise exception 'An exercise is repeated within a day' using errcode = '22023';
    end if;

    if exists (
      select 1 from jsonb_array_elements(v_day -> 'exercises') e
       where not exists (select 1 from public.exercises x
                          where x.id = (e ->> 'exercise_id')::uuid)
    ) then
      raise exception 'Unknown exercise' using errcode = '22023';
    end if;

    select coalesce(array_agg((e ->> 'id')::uuid), '{}')
      into v_keep_ex
      from jsonb_array_elements(v_day -> 'exercises') e
     where e ->> 'id' is not null;

    if exists (
      select 1 from unnest(v_keep_ex) k
       where not exists (select 1 from public.program_exercises pe
                          where pe.id = k and pe.program_day_id = v_day_id)
    ) then
      raise exception 'Unknown program exercise' using errcode = '22023';
    end if;

    delete from public.program_exercises
     where program_day_id = v_day_id
       and not (id = any (v_keep_ex));

    update public.program_exercises
       set position = position + 1000
     where program_day_id = v_day_id;

    v_ex_pos := 0;
    for v_ex in select value from jsonb_array_elements(v_day -> 'exercises')
    loop
      if v_ex ->> 'id' is null then
        insert into public.program_exercises
          (program_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds,
           transition_rest_seconds)
        values (
          v_day_id,
          (v_ex ->> 'exercise_id')::uuid,
          v_ex_pos,
          (v_ex ->> 'target_sets')::smallint,
          (v_ex ->> 'rep_min')::smallint,
          (v_ex ->> 'rep_max')::smallint,
          (v_ex ->> 'rest_seconds')::smallint,
          (v_ex ->> 'transition_rest_seconds')::integer
        );
      else
        v_ex_id := (v_ex ->> 'id')::uuid;
        update public.program_exercises
           set exercise_id             = (v_ex ->> 'exercise_id')::uuid,
               position                = v_ex_pos,
               target_sets             = (v_ex ->> 'target_sets')::smallint,
               rep_min                 = (v_ex ->> 'rep_min')::smallint,
               rep_max                 = (v_ex ->> 'rep_max')::smallint,
               rest_seconds            = (v_ex ->> 'rest_seconds')::smallint,
               transition_rest_seconds = (v_ex ->> 'transition_rest_seconds')::integer
         where id = v_ex_id;
      end if;
      v_ex_pos := v_ex_pos + 1;
    end loop;

    v_day_pos := v_day_pos + 1;
  end loop;
end;
$$;

grant execute on function public.save_program(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3. clone_program — як у 20261119000002_better_templates.sql, плюс
--    копіювання transition_rest_seconds.
-- ---------------------------------------------------------------------
create or replace function public.clone_program(template_id uuid, p_locale text default 'en')
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid            uuid := auth.uid();
  use_uk         boolean := coalesce(p_locale, 'en') = 'uk';
  new_program_id uuid;
  src_day        record;
  new_day_id     uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.programs (owner_id, name, description, days_per_week, source_template_id)
  select uid,
         case when use_uk and p.name_uk is not null then p.name_uk else p.name end,
         case when use_uk and p.description_uk is not null then p.description_uk else p.description end,
         p.days_per_week, p.id
  from public.programs p
  where p.id = template_id
  returning id into new_program_id;

  if new_program_id is null then
    raise exception 'Program % not found', template_id;
  end if;

  for src_day in
    select * from public.program_days where program_id = template_id order by position
  loop
    insert into public.program_days (program_id, name, position)
    values (
      new_program_id,
      case when use_uk and src_day.name_uk is not null then src_day.name_uk else src_day.name end,
      src_day.position
    )
    returning id into new_day_id;

    insert into public.program_exercises
      (program_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds,
       transition_rest_seconds)
    select new_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds,
           transition_rest_seconds
    from public.program_exercises
    where program_day_id = src_day.id;
  end loop;

  return new_program_id;
end;
$$;

revoke all on function public.clone_program(uuid, text) from public;
revoke all on function public.clone_program(uuid, text) from anon;
grant execute on function public.clone_program(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. is_compound системних вправ перевірено (53 у seed.sql) — помилок
--    немає, UPDATE не потрібен.
-- ---------------------------------------------------------------------

notify pgrst, 'reload schema';
