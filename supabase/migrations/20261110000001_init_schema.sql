-- =====================================================================
-- GainStep — початкова схема БД
-- Усі ваги зберігаються в кілограмах; одиниці (kg/lb) — лише для відображення.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Типи-переліки
-- ---------------------------------------------------------------------
create type public.experience_level as enum ('beginner', 'intermediate');
create type public.training_goal    as enum ('strength', 'hypertrophy');
create type public.weight_unit      as enum ('kg', 'lb');

create type public.muscle_group as enum (
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'core'
);

create type public.equipment_type as enum (
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell'
);

create type public.workout_status as enum ('in_progress', 'completed');

-- ---------------------------------------------------------------------
-- Допоміжна функція: автоматичне оновлення updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- exercises — бібліотека вправ
-- owner_id IS NULL  → системна вправа (бачать усі)
-- owner_id = user   → власна вправа користувача
-- ---------------------------------------------------------------------
create table public.exercises (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 80),
  muscle_group     public.muscle_group not null,
  equipment        public.equipment_type not null,
  description      text,
  is_compound      boolean not null default false,
  -- крок збільшення ваги для алгоритму прогресії, кг
  weight_increment numeric(4, 2) not null default 2.5 check (weight_increment > 0),
  created_at       timestamptz not null default now()
);

-- назва унікальна в межах «простору» власника (системні окремо від користувацьких)
create unique index exercises_owner_name_uniq
  on public.exercises (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index exercises_owner_idx on public.exercises (owner_id);
create index exercises_muscle_idx on public.exercises (muscle_group);

-- ---------------------------------------------------------------------
-- programs — програми тренувань
-- owner_id IS NULL → шаблон; інакше — програма користувача
-- ---------------------------------------------------------------------
create table public.programs (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid references auth.users (id) on delete cascade,
  name               text not null check (char_length(name) between 2 and 80),
  description        text,
  days_per_week      smallint not null check (days_per_week between 1 and 7),
  source_template_id uuid references public.programs (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index programs_owner_idx on public.programs (owner_id);

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- program_days — дні програми (Push, Pull, Legs...)
-- ---------------------------------------------------------------------
create table public.program_days (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  position   smallint not null check (position >= 0),
  unique (program_id, position)
);

create index program_days_program_idx on public.program_days (program_id);

-- ---------------------------------------------------------------------
-- program_exercises — вправи дня з цільовими підходами й повтореннями (3×8–12)
-- ---------------------------------------------------------------------
create table public.program_exercises (
  id             uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days (id) on delete cascade,
  exercise_id    uuid not null references public.exercises (id) on delete restrict,
  position       smallint not null check (position >= 0),
  target_sets    smallint not null default 3 check (target_sets between 1 and 10),
  rep_min        smallint not null default 8 check (rep_min between 1 and 100),
  rep_max        smallint not null default 12 check (rep_max between 1 and 100),
  rest_seconds   smallint not null default 120 check (rest_seconds between 0 and 900),
  check (rep_min <= rep_max),
  unique (program_day_id, position)
);

create index program_exercises_day_idx on public.program_exercises (program_day_id);
create index program_exercises_exercise_idx on public.program_exercises (exercise_id);

-- ---------------------------------------------------------------------
-- profiles — дані користувача (1:1 з auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text check (char_length(display_name) <= 60),
  experience        public.experience_level,
  goal              public.training_goal,
  unit              public.weight_unit not null default 'kg',
  active_program_id uuid references public.programs (id) on delete set null,
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- workouts — проведені тренування
-- id може згенерувати клієнт (crypto.randomUUID) — це робить
-- офлайн-синхронізацію ідемпотентною: повторна відправка не створить дубль.
-- ---------------------------------------------------------------------
create table public.workouts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_day_id uuid references public.program_days (id) on delete set null,
  name           text not null check (char_length(name) between 1 and 80),
  status         public.workout_status not null default 'in_progress',
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  notes          text check (char_length(notes) <= 2000),
  created_at     timestamptz not null default now(),
  check (finished_at is null or finished_at >= started_at),
  check (status = 'in_progress' or finished_at is not null)
);

create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

-- ---------------------------------------------------------------------
-- workout_sets — виконані підходи
-- ---------------------------------------------------------------------
create table public.workout_sets (
  id                uuid primary key default gen_random_uuid(),
  workout_id        uuid not null references public.workouts (id) on delete cascade,
  exercise_id       uuid not null references public.exercises (id) on delete restrict,
  exercise_position smallint not null check (exercise_position >= 0),
  set_number        smallint not null check (set_number >= 1),
  weight            numeric(6, 2) not null check (weight >= 0),
  reps              smallint not null check (reps between 0 and 100),
  is_completed      boolean not null default false,
  completed_at      timestamptz,
  unique (workout_id, exercise_id, set_number)
);

create index workout_sets_workout_idx on public.workout_sets (workout_id);
create index workout_sets_exercise_idx on public.workout_sets (exercise_id);

-- ---------------------------------------------------------------------
-- body_weight_entries — записи ваги тіла (одна на день)
-- ---------------------------------------------------------------------
create table public.body_weight_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weight      numeric(5, 2) not null check (weight between 20 and 400),
  recorded_on date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create index body_weight_user_date_idx on public.body_weight_entries (user_id, recorded_on desc);

-- =====================================================================
-- Row Level Security: кожен користувач бачить лише своє
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.exercises           enable row level security;
alter table public.programs            enable row level security;
alter table public.program_days        enable row level security;
alter table public.program_exercises   enable row level security;
alter table public.workouts            enable row level security;
alter table public.workout_sets        enable row level security;
alter table public.body_weight_entries enable row level security;

-- profiles: лише свій рядок (створюється тригером, тому insert не потрібен)
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- exercises: читати системні + свої, змінювати лише свої
create policy "exercises_select" on public.exercises
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "exercises_insert_own" on public.exercises
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "exercises_update_own" on public.exercises
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "exercises_delete_own" on public.exercises
  for delete to authenticated using (owner_id = (select auth.uid()));

-- programs: читати шаблони + свої, змінювати лише свої
create policy "programs_select" on public.programs
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "programs_insert_own" on public.programs
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "programs_update_own" on public.programs
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "programs_delete_own" on public.programs
  for delete to authenticated using (owner_id = (select auth.uid()));

-- program_days: доступ успадковується від програми
create policy "program_days_select" on public.program_days
  for select to authenticated using (
    exists (select 1 from public.programs p
            where p.id = program_id
              and (p.owner_id is null or p.owner_id = (select auth.uid())))
  );
create policy "program_days_write_own" on public.program_days
  for all to authenticated
  using (exists (select 1 from public.programs p
                 where p.id = program_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.programs p
                      where p.id = program_id and p.owner_id = (select auth.uid())));

-- program_exercises: доступ через день → програму
create policy "program_exercises_select" on public.program_exercises
  for select to authenticated using (
    exists (select 1 from public.program_days d
            join public.programs p on p.id = d.program_id
            where d.id = program_day_id
              and (p.owner_id is null or p.owner_id = (select auth.uid())))
  );
create policy "program_exercises_write_own" on public.program_exercises
  for all to authenticated
  using (exists (select 1 from public.program_days d
                 join public.programs p on p.id = d.program_id
                 where d.id = program_day_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.program_days d
                      join public.programs p on p.id = d.program_id
                      where d.id = program_day_id and p.owner_id = (select auth.uid())));

-- workouts: лише свої
create policy "workouts_all_own" on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- workout_sets: через тренування
create policy "workout_sets_all_own" on public.workout_sets
  for all to authenticated
  using (exists (select 1 from public.workouts w
                 where w.id = workout_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workouts w
                      where w.id = workout_id and w.user_id = (select auth.uid())));

-- body_weight_entries: лише свої
create policy "body_weight_all_own" on public.body_weight_entries
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- =====================================================================
-- Автоматичне створення профілю при реєстрації
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Копіювання шаблону програми в програми користувача (онбординг)
-- security invoker: вставки проходять через RLS від імені користувача
-- =====================================================================
create or replace function public.clone_program(template_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid            uuid := auth.uid();
  new_program_id uuid;
  src_day        record;
  new_day_id     uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.programs (owner_id, name, description, days_per_week, source_template_id)
  select uid, p.name, p.description, p.days_per_week, p.id
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
    values (new_program_id, src_day.name, src_day.position)
    returning id into new_day_id;

    insert into public.program_exercises
      (program_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds)
    select new_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds
    from public.program_exercises
    where program_day_id = src_day.id;
  end loop;

  return new_program_id;
end;
$$;

grant execute on function public.clone_program(uuid) to authenticated;