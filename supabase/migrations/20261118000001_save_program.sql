-- =====================================================================
-- save_program — атомарне збереження програми з редактора
--
-- p_payload:
-- {
--   "name": "Push Pull Legs",
--   "days": [
--     { "id": "<uuid>" | null, "name": "Push",
--       "exercises": [
--         { "id": "<uuid>" | null, "exercise_id": "<uuid>",
--           "target_sets": 3, "rep_min": 8, "rep_max": 12, "rest_seconds": 90 }
--       ] }
--   ]
-- }
-- Порядок у масивах = position. id = null → новий рядок; рядки, яких
-- немає в payload, видаляються. Видалення дня НЕ чіпає історію:
-- workouts.program_day_id → on delete set null.
--
-- Двофазне оновлення position: через unique(…, position) і
-- check (position >= 0) спершу зсуваємо наявні рядки на +1000
-- (від'ємні значення заборонені check-обмеженням), потім ставимо
-- остаточні 0..n-1.
--
-- security invoker: усі зміни проходять через RLS від імені користувача.
-- Функція виконується в одній транзакції — будь-яка помилка відкочує все.
-- =====================================================================
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

  -- 1. Програма (лише власна; шаблони змінювати не можна)
  update public.programs
     set name = v_name,
         days_per_week = jsonb_array_length(v_days)
   where id = p_program_id and owner_id = uid;
  if not found then
    raise exception 'Program not found' using errcode = 'P0002';
  end if;

  -- 2. Дні: наявні id мають належати цій програмі
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

  -- фаза 1: звільняємо позиції 0..n-1
  update public.program_days
     set position = position + 1000
   where program_id = p_program_id;

  -- фаза 2: остаточні позиції, вставка нових днів
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

    -- одна вправа не повторюється в межах дня
    if (select count(*) from jsonb_array_elements(v_day -> 'exercises'))
       <> (select count(distinct e ->> 'exercise_id') from jsonb_array_elements(v_day -> 'exercises') e) then
      raise exception 'An exercise is repeated within a day' using errcode = '22023';
    end if;

    -- вправи мають бути доступні користувачу (системні або власні; RLS)
    if exists (
      select 1 from jsonb_array_elements(v_day -> 'exercises') e
       where not exists (select 1 from public.exercises x
                          where x.id = (e ->> 'exercise_id')::uuid)
    ) then
      raise exception 'Unknown exercise' using errcode = '22023';
    end if;

    -- 3. Вправи дня — за тим самим принципом
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
          (program_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds)
        values (
          v_day_id,
          (v_ex ->> 'exercise_id')::uuid,
          v_ex_pos,
          (v_ex ->> 'target_sets')::smallint,
          (v_ex ->> 'rep_min')::smallint,
          (v_ex ->> 'rep_max')::smallint,
          (v_ex ->> 'rest_seconds')::smallint
        );
      else
        v_ex_id := (v_ex ->> 'id')::uuid;
        update public.program_exercises
           set exercise_id  = (v_ex ->> 'exercise_id')::uuid,
               position     = v_ex_pos,
               target_sets  = (v_ex ->> 'target_sets')::smallint,
               rep_min      = (v_ex ->> 'rep_min')::smallint,
               rep_max      = (v_ex ->> 'rep_max')::smallint,
               rest_seconds = (v_ex ->> 'rest_seconds')::smallint
         where id = v_ex_id;
      end if;
      v_ex_pos := v_ex_pos + 1;
    end loop;

    v_day_pos := v_day_pos + 1;
  end loop;
end;
$$;

grant execute on function public.save_program(uuid, jsonb) to authenticated;
