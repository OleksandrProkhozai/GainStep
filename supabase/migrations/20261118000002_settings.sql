-- =====================================================================
-- Settings: таймер відпочинку за замовчуванням, видалення акаунта,
-- застосування таймера до всіх програм користувача.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles.default_rest_seconds — відпочинок для нових вправ
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists default_rest_seconds integer not null default 90;

alter table public.profiles
  drop constraint if exists profiles_default_rest_seconds_check;
alter table public.profiles
  add constraint profiles_default_rest_seconds_check
  check (default_rest_seconds between 0 and 600);

-- ---------------------------------------------------------------------
-- 2. delete_my_account() — видаляє поточного користувача з усіма даними.
--
-- security definer: користувач не має прав на auth.users, тому функція
-- виконується від імені власника (postgres). Усе обмежено auth.uid().
--
-- Чому дані видаляються явно, а не лише каскадом від auth.users:
-- workout_sets.exercise_id і program_exercises.exercise_id мають
-- ON DELETE RESTRICT. Каскад auth.users → exercises (власні вправи) і
-- каскад auth.users → workouts → workout_sets ідуть паралельними гілками,
-- і RESTRICT перевіряється одразу — порядок гілок не гарантований, тож
-- видалення може впасти. Тому спершу тренування й програми, потім вправи.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  delete from public.workouts            where user_id = uid;   -- → workout_sets (cascade)
  delete from public.body_weight_entries where user_id = uid;
  update public.profiles set active_program_id = null where id = uid;
  delete from public.programs            where owner_id = uid;  -- → program_days → program_exercises
  delete from public.exercises           where owner_id = uid;
  delete from public.profiles            where id = uid;
  delete from auth.users                 where id = uid;        -- сесії, identities (cascade у схемі auth)
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------
-- 3. apply_default_rest(p_seconds) — однаковий відпочинок для всіх вправ
-- у програмах користувача. security invoker: оновлення проходить через
-- RLS (program_exercises_write_own), шаблони (owner_id is null) не чіпає.
-- Повертає кількість оновлених рядків.
-- ---------------------------------------------------------------------
create or replace function public.apply_default_rest(p_seconds integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  updated integer;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_seconds is null or p_seconds < 0 or p_seconds > 600 then
    raise exception 'Rest must be between 0 and 600 seconds' using errcode = '22023';
  end if;

  update public.program_exercises pe
     set rest_seconds = p_seconds
    from public.program_days d
    join public.programs p on p.id = d.program_id
   where pe.program_day_id = d.id
     and p.owner_id = uid
     and pe.rest_seconds is distinct from p_seconds;

  get diagnostics updated = row_count;
  return updated;
end;
$$;

revoke all on function public.apply_default_rest(integer) from public;
revoke all on function public.apply_default_rest(integer) from anon;
grant execute on function public.apply_default_rest(integer) to authenticated;
