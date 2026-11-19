-- =====================================================================
-- "Відпочинок за замовчуванням" → "Мінімальний відпочинок".
-- profiles.min_rest_seconds — нижня межа відпочинку будь-якої вправи.
-- Застосовується лише при показі й у таймері: program_exercises.rest_seconds
-- не змінюються. 0 — вимкнено.
-- Ідемпотентна: можна запускати повторно.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. default_rest_seconds → min_rest_seconds (поточні значення зберігаються)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles'
                and column_name = 'default_rest_seconds')
     and not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles'
                and column_name = 'min_rest_seconds') then
    alter table public.profiles rename column default_rest_seconds to min_rest_seconds;
  end if;
end;
$$;

-- Якщо міграцію settings не застосовували зовсім — колонки ще немає.
alter table public.profiles
  add column if not exists min_rest_seconds integer not null default 0;

alter table public.profiles
  alter column min_rest_seconds set default 0;

alter table public.profiles
  drop constraint if exists profiles_default_rest_seconds_check;
alter table public.profiles
  drop constraint if exists profiles_min_rest_seconds_check;
alter table public.profiles
  add constraint profiles_min_rest_seconds_check
  check (min_rest_seconds between 0 and 600);

-- ---------------------------------------------------------------------
-- 2. apply_default_rest більше не потрібна: rest_seconds у програмах
-- не перезаписуються, мінімум застосовується при показі.
-- ---------------------------------------------------------------------
drop function if exists public.apply_default_rest(integer);

notify pgrst, 'reload schema';
