-- =====================================================================
-- Перероблені шаблони програм (Full Body, Upper / Lower, Push Pull Legs)
-- за рекомендаціями ACSM: 8–12 повторень для новачків, 10–20 підходів
-- на м'яз на тиждень, базові вправи на початку, ізолюючі в кінці,
-- відпочинок 2–3 хв на базових і 60–90 с на ізолюючих.
--
-- Залежить від 20261119000001_more_exercises.sql
-- (Pec Deck Fly, Rope Triceps Pushdown, Wide-Grip Lat Pulldown).
--
-- Змінює лише шаблони (owner_id is null). Програми користувачів, зокрема
-- копії шаблонів, не змінюються. Ідемпотентна: можна запускати повторно.
-- =====================================================================

-- ---------------------------------------------------------------------
-- a) programs: опис українською і рівень шаблону
-- ---------------------------------------------------------------------
alter table public.programs add column if not exists description_uk text;
-- Рівень, для якого призначено шаблон; у програм користувачів — null.
alter table public.programs add column if not exists level public.experience_level;

update public.programs p
   set name           = v.name,
       name_uk        = v.name_uk,
       description    = v.description,
       description_uk = v.description_uk,
       days_per_week  = v.days_per_week,
       level          = v.level::public.experience_level
  from (values
    ('10000000-0000-0000-0000-000000000001'::uuid, 'Full Body', 'Все тіло',
     'Whole body every session, 3× a week. Alternate days A and B. Best for beginners.',
     'Усе тіло за одне тренування, 3 рази на тиждень. Дні A і B чергуються. Найкраще для початківців.',
     3, 'beginner'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'Upper / Lower', 'Верх / Низ',
     'Upper and lower body on alternate days, 4× a week. Each muscle twice a week.',
     'Верх і низ тіла по черзі, 4 рази на тиждень. Кожен м''яз — двічі на тиждень.',
     4, 'beginner'),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'Push Pull Legs', 'Жим / Тяга / Ноги',
     'Push, pull and legs. Run 3× a week or twice through for 6× a week.',
     'Жими, тяги, ноги. 3 тренування на тиждень або двічі по колу — 6.',
     6, 'intermediate')
  ) as v(id, name, name_uk, description, description_uk, days_per_week, level)
 where p.id = v.id
   and p.owner_id is null;

-- ---------------------------------------------------------------------
-- b) program_days шаблонів.
-- На program_days посилається workouts.program_day_id, тому дні не
-- видаляються, а оновлюються за фіксованими id. unique (program_id, position)
-- не відкладений — позиції змінюються у дві фази: спочатку зсув усіх днів
-- шаблонів за межі нових позицій, потім upsert.
-- ---------------------------------------------------------------------
update public.program_days
   set position = position + 100
 where program_id in (
   '10000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000003'
 );

insert into public.program_days (id, program_id, name, name_uk, position)
values
  -- Full Body
  ('20000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000001', 'Full Body A', 'Все тіло A', 0),
  ('20000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000001', 'Full Body B', 'Все тіло B', 1),
  -- Upper / Lower
  ('20000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000002', 'Upper A', 'Верх A', 0),
  ('20000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000002', 'Lower A', 'Низ A', 1),
  ('20000000-0000-0000-0000-000000000203', '10000000-0000-0000-0000-000000000002', 'Upper B', 'Верх B', 2),
  ('20000000-0000-0000-0000-000000000204', '10000000-0000-0000-0000-000000000002', 'Lower B', 'Низ B', 3),
  -- Push Pull Legs
  ('20000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000003', 'Push', 'Жим', 0),
  ('20000000-0000-0000-0000-000000000302', '10000000-0000-0000-0000-000000000003', 'Pull', 'Тяга', 1),
  ('20000000-0000-0000-0000-000000000303', '10000000-0000-0000-0000-000000000003', 'Legs', 'Ноги', 2)
on conflict (id) do update
  set name     = excluded.name,
      name_uk  = excluded.name_uk,
      position = excluded.position;

-- ---------------------------------------------------------------------
-- c) Вправи днів шаблонів: повна заміна.
-- Якщо вставлено не 58 рядків (12 + 25 + 21) — помилка з назвами вправ,
-- яких немає серед системних (і вся міграція відкочується).
-- ---------------------------------------------------------------------
do $$
declare
  inserted int;
  missing  text;
begin
  delete from public.program_exercises pe
   using public.program_days d
   where pe.program_day_id = d.id
     and d.program_id in (
       '10000000-0000-0000-0000-000000000001',
       '10000000-0000-0000-0000-000000000002',
       '10000000-0000-0000-0000-000000000003'
     );

  with v (day_id, pos, exercise_name, sets, rmin, rmax, rest) as (values
    -- Full Body A
    ('20000000-0000-0000-0000-000000000101', 0, 'Back Squat',                 3, 6,  10, 180),
    ('20000000-0000-0000-0000-000000000101', 1, 'Bench Press',                3, 6,  10, 150),
    ('20000000-0000-0000-0000-000000000101', 2, 'Lat Pulldown',               3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000101', 3, 'Romanian Deadlift',          3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000101', 4, 'Lateral Raise',              2, 12, 15, 60),
    ('20000000-0000-0000-0000-000000000101', 5, 'Plank',                      3, 30, 60, 60),
    -- Full Body B
    ('20000000-0000-0000-0000-000000000102', 0, 'Deadlift',                   3, 5,  8,  180),
    ('20000000-0000-0000-0000-000000000102', 1, 'Overhead Press',             3, 6,  10, 150),
    ('20000000-0000-0000-0000-000000000102', 2, 'Incline Dumbbell Press',     3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000102', 3, 'Seated Cable Row',           3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000102', 4, 'Leg Press',                  3, 10, 15, 120),
    ('20000000-0000-0000-0000-000000000102', 5, 'Cable Crunch',               3, 10, 15, 60),
    -- Upper A
    ('20000000-0000-0000-0000-000000000201', 0, 'Bench Press',                4, 5,  8,  180),
    ('20000000-0000-0000-0000-000000000201', 1, 'Barbell Row',                4, 6,  10, 150),
    ('20000000-0000-0000-0000-000000000201', 2, 'Overhead Press',             3, 6,  10, 150),
    ('20000000-0000-0000-0000-000000000201', 3, 'Lat Pulldown',               3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000201', 4, 'Barbell Curl',               2, 8,  12, 90),
    ('20000000-0000-0000-0000-000000000201', 5, 'Triceps Pushdown',           2, 10, 15, 60),
    -- Lower A
    ('20000000-0000-0000-0000-000000000202', 0, 'Back Squat',                 4, 5,  8,  180),
    ('20000000-0000-0000-0000-000000000202', 1, 'Romanian Deadlift',          3, 6,  10, 150),
    ('20000000-0000-0000-0000-000000000202', 2, 'Leg Press',                  3, 10, 15, 120),
    ('20000000-0000-0000-0000-000000000202', 3, 'Lying Leg Curl',             3, 10, 15, 90),
    ('20000000-0000-0000-0000-000000000202', 4, 'Standing Calf Raise',        4, 10, 15, 60),
    ('20000000-0000-0000-0000-000000000202', 5, 'Plank',                      3, 30, 60, 60),
    -- Upper B
    ('20000000-0000-0000-0000-000000000203', 0, 'Incline Dumbbell Press',     3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000203', 1, 'Seated Cable Row',           3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000203', 2, 'Dumbbell Shoulder Press',    3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000203', 3, 'Wide-Grip Lat Pulldown',     3, 10, 12, 90),
    ('20000000-0000-0000-0000-000000000203', 4, 'Lateral Raise',              3, 12, 15, 60),
    ('20000000-0000-0000-0000-000000000203', 5, 'Hammer Curl',                2, 10, 12, 60),
    ('20000000-0000-0000-0000-000000000203', 6, 'Rope Triceps Pushdown',      2, 10, 15, 60),
    -- Lower B
    ('20000000-0000-0000-0000-000000000204', 0, 'Deadlift',                   3, 4,  6,  180),
    ('20000000-0000-0000-0000-000000000204', 1, 'Bulgarian Split Squat',      3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000204', 2, 'Hip Thrust',                 3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000204', 3, 'Leg Extension',              3, 12, 15, 60),
    ('20000000-0000-0000-0000-000000000204', 4, 'Seated Calf Raise',          4, 12, 15, 60),
    ('20000000-0000-0000-0000-000000000204', 5, 'Hanging Leg Raise',          3, 8,  15, 60),
    -- Push
    ('20000000-0000-0000-0000-000000000301', 0, 'Bench Press',                4, 6,  10, 180),
    ('20000000-0000-0000-0000-000000000301', 1, 'Overhead Press',             3, 6,  10, 150),
    ('20000000-0000-0000-0000-000000000301', 2, 'Incline Dumbbell Press',     3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000301', 3, 'Pec Deck Fly',               3, 12, 15, 60),
    ('20000000-0000-0000-0000-000000000301', 4, 'Lateral Raise',              4, 12, 15, 60),
    ('20000000-0000-0000-0000-000000000301', 5, 'Rope Triceps Pushdown',      3, 10, 15, 60),
    ('20000000-0000-0000-0000-000000000301', 6, 'Overhead Triceps Extension', 2, 10, 15, 60),
    -- Pull
    ('20000000-0000-0000-0000-000000000302', 0, 'Pull-up',                    4, 6,  10, 150),
    ('20000000-0000-0000-0000-000000000302', 1, 'Barbell Row',                4, 6,  10, 150),
    ('20000000-0000-0000-0000-000000000302', 2, 'Seated Cable Row',           3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000302', 3, 'Face Pull',                  3, 12, 15, 60),
    ('20000000-0000-0000-0000-000000000302', 4, 'Rear Delt Fly',              2, 12, 15, 60),
    ('20000000-0000-0000-0000-000000000302', 5, 'Barbell Curl',               3, 8,  12, 90),
    ('20000000-0000-0000-0000-000000000302', 6, 'Hammer Curl',                2, 10, 12, 60),
    -- Legs
    ('20000000-0000-0000-0000-000000000303', 0, 'Back Squat',                 4, 6,  10, 180),
    ('20000000-0000-0000-0000-000000000303', 1, 'Romanian Deadlift',          3, 8,  10, 150),
    ('20000000-0000-0000-0000-000000000303', 2, 'Leg Press',                  3, 10, 15, 120),
    ('20000000-0000-0000-0000-000000000303', 3, 'Lying Leg Curl',             3, 10, 15, 90),
    ('20000000-0000-0000-0000-000000000303', 4, 'Leg Extension',              3, 12, 15, 60),
    ('20000000-0000-0000-0000-000000000303', 5, 'Standing Calf Raise',        4, 10, 15, 60),
    ('20000000-0000-0000-0000-000000000303', 6, 'Cable Crunch',               3, 10, 15, 60)
  ),
  ins as (
    insert into public.program_exercises
      (program_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds)
    select v.day_id::uuid, e.id, v.pos, v.sets, v.rmin, v.rmax, v.rest
      from v
      join public.exercises e on e.owner_id is null and e.name = v.exercise_name
    returning 1
  )
  select (select count(*) from ins),
         (select string_agg(distinct v.exercise_name, ', ')
            from v
           where not exists (select 1 from public.exercises e
                              where e.owner_id is null and e.name = v.exercise_name))
    into inserted, missing;

  if inserted <> 58 then
    raise exception 'Template exercises: inserted % of 58. Missing system exercises: %',
      inserted, coalesce(missing, '—')
      using hint = 'Run 20261119000001_more_exercises.sql first.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- d) clone_program: копія бере опис мовою p_locale; level не копіюється
-- (у програм користувачів він null).
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
      (program_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds)
    select new_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds
    from public.program_exercises
    where program_day_id = src_day.id;
  end loop;

  return new_program_id;
end;
$$;

revoke all on function public.clone_program(uuid, text) from public;
revoke all on function public.clone_program(uuid, text) from anon;
grant execute on function public.clone_program(uuid, text) to authenticated;

notify pgrst, 'reload schema';
