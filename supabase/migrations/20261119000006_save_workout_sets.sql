-- =====================================================================
-- save_workout_sets — атомарне редагування завершеного тренування
-- (сторінка /workouts/[id]/edit).
--
-- p_sets — масив підходів у порядку показу:
-- [
--   { "exercise_id": "<uuid>", "weight": 80, "reps": 10,
--     "is_completed": true, "completed_at": "<iso>" | null }
-- ]
-- Порядок першої появи вправи в масиві = exercise_position (0..n-1),
-- set_number = 1..n у межах кожної вправи (unique(workout_id, exercise_id,
-- set_number) не порушується).
--
-- Що робить в одній транзакції:
--   1) перевіряє, що тренування належить користувачу і завершене;
--   2) видаляє всі підходи тренування і вставляє нові;
--   3) оновлює notes і started_at; finished_at зсувається на ту саму
--      різницю (тривалість не змінюється); completed_at виконаних
--      підходів — так само.
--
-- security invoker: усі зміни проходять через RLS від імені користувача
-- (workouts_all_own, workout_sets_all_own). Будь-яка помилка відкочує все.
-- Ідемпотентна: можна запускати повторно.
-- =====================================================================
create or replace function public.save_workout_sets(
  p_workout_id uuid,
  p_sets       jsonb,
  p_notes      text,
  p_started_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid        uuid := auth.uid();
  v_started  timestamptz;
  v_finished timestamptz;
  v_shift    interval;
  v_notes    text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_sets is null or jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) = 0 then
    raise exception 'A workout needs at least one set' using errcode = '22023';
  end if;

  if p_started_at is null or p_started_at > now() then
    raise exception 'Start time cannot be in the future' using errcode = '22023';
  end if;

  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'Notes are too long' using errcode = '22023';
  end if;

  -- 1. Лише власне завершене тренування; рядок блокується до кінця транзакції.
  select w.started_at, w.finished_at
    into v_started, v_finished
    from public.workouts w
   where w.id = p_workout_id
     and w.user_id = uid
     and w.status = 'completed'
     for update;
  if not found then
    raise exception 'Workout not found' using errcode = 'P0002';
  end if;

  -- Вправи мають бути доступні користувачу (системні або власні; RLS).
  if exists (
    select 1 from jsonb_array_elements(p_sets) s
     where not exists (select 1 from public.exercises x
                        where x.id = (s ->> 'exercise_id')::uuid)
  ) then
    raise exception 'Unknown exercise' using errcode = '22023';
  end if;

  v_shift := p_started_at - v_started;

  -- 2. Підходи: видалити всі й вставити заново.
  delete from public.workout_sets where workout_id = p_workout_id;

  with ordered as (
    select s.value as item, s.ordinality as ord
      from jsonb_array_elements(p_sets) with ordinality as s
  ),
  firsts as (
    select item ->> 'exercise_id' as exercise_id, min(ord) as first_ord
      from ordered
     group by 1
  )
  insert into public.workout_sets
    (workout_id, exercise_id, exercise_position, set_number, weight, reps, is_completed, completed_at)
  select
    p_workout_id,
    (o.item ->> 'exercise_id')::uuid,
    (dense_rank() over (order by f.first_ord) - 1)::smallint,
    (row_number() over (partition by o.item ->> 'exercise_id' order by o.ord))::smallint,
    (o.item ->> 'weight')::numeric(6, 2),
    (o.item ->> 'reps')::smallint,
    coalesce((o.item ->> 'is_completed')::boolean, false),
    case
      when coalesce((o.item ->> 'is_completed')::boolean, false)
        then coalesce((o.item ->> 'completed_at')::timestamptz + v_shift, v_finished + v_shift)
      else null
    end
  from ordered o
  join firsts f on f.exercise_id = o.item ->> 'exercise_id';

  -- 3. Нотатка і час: тривалість (finished_at − started_at) зберігається.
  update public.workouts
     set notes       = v_notes,
         started_at  = p_started_at,
         finished_at = v_finished + v_shift
   where id = p_workout_id;
end;
$$;

revoke all on function public.save_workout_sets(uuid, jsonb, text, timestamptz) from public;
revoke all on function public.save_workout_sets(uuid, jsonb, text, timestamptz) from anon;
grant execute on function public.save_workout_sets(uuid, jsonb, text, timestamptz) to authenticated;
