-- =====================================================================
-- Перевірка перед злиттям "Lat Pulldown" → "Wide-Grip Lat Pulldown".
-- Лише SELECT — нічого не змінює. Запускати в Supabase SQL Editor
-- (роль postgres, RLS не обмежує) до і після міграції
-- 20261127000001_merge_lat_pulldown.sql. Після міграції всі лічильники
-- для "Lat Pulldown" мають бути 0 (а секція 0 — без рядка old).
-- =====================================================================

-- 0) Обидві системні вправи (і "Triceps Pushdown" для перейменування)
select 'exercise' as section, e.name, e.name_uk, e.id, e.equipment, e.weight_increment
  from public.exercises e
 where e.owner_id is null
   and e.name in ('Lat Pulldown', 'Wide-Grip Lat Pulldown',
                  'Triceps Pushdown', 'Straight-Bar Triceps Pushdown')
 order by e.name;

-- 1) program_exercises: по програмах, окремо шаблони й програми користувачів
with old as (
  select id from public.exercises where owner_id is null and name = 'Lat Pulldown'
), new as (
  select id from public.exercises where owner_id is null and name = 'Wide-Grip Lat Pulldown'
)
select case when p.owner_id is null then 'template' else 'user program' end as kind,
       p.id   as program_id,
       p.name as program_name,
       d.name as day_name,
       pe.position,
       -- у тому ж дні вже є нова вправа → рядок старої буде видалено, позиції ущільнено
       exists (select 1 from public.program_exercises x
                where x.program_day_id = pe.program_day_id
                  and x.exercise_id = (select id from new)) as day_has_new
  from public.program_exercises pe
  join public.program_days d on d.id = pe.program_day_id
  join public.programs p     on p.id = d.program_id
 where pe.exercise_id = (select id from old)
 order by kind, p.name, d.position, pe.position;

-- 1b) program_exercises: підсумок
select case when p.owner_id is null then 'template' else 'user program' end as kind,
       count(*)                      as rows,
       count(distinct p.id)          as programs
  from public.program_exercises pe
  join public.program_days d on d.id = pe.program_day_id
  join public.programs p     on p.id = d.program_id
 where pe.exercise_id = (select id from public.exercises where owner_id is null and name = 'Lat Pulldown')
 group by 1;

-- 2) workout_sets: кількість підходів і тренувань
select count(*)                          as sets,
       count(*) filter (where ws.is_completed) as completed_sets,
       count(distinct ws.workout_id)     as workouts,
       count(distinct w.user_id)         as users
  from public.workout_sets ws
  join public.workouts w on w.id = ws.workout_id
 where ws.exercise_id = (select id from public.exercises where owner_id is null and name = 'Lat Pulldown');

-- 2b) Незавершені тренування зі старою вправою — міграція з ними НЕ запуститься
--     (стан такого тренування живе на пристрої зі старим id). Завершіть або
--     скасуйте їх у застосунку. Має бути 0 рядків.
select w.id, w.name, w.started_at
  from public.workouts w
 where w.status = 'in_progress'
   and (exists (select 1 from public.workout_sets ws
                 where ws.workout_id = w.id
                   and ws.exercise_id = (select id from public.exercises where owner_id is null and name = 'Lat Pulldown'))
        or (w.exercise_plan is not null
            and exists (select 1 from jsonb_array_elements(w.exercise_plan) e
                         where e ->> 'exercise_id' = (select id::text from public.exercises
                                                       where owner_id is null and name = 'Lat Pulldown'))));

-- 3) workouts.exercise_plan (jsonb): тренування, у складі яких є стара вправа
select count(*) as workouts_with_old_in_plan,
       count(*) filter (
         where exists (select 1 from jsonb_array_elements(w.exercise_plan) e
                        where e ->> 'exercise_id' = (select id::text from public.exercises
                                                      where owner_id is null and name = 'Wide-Grip Lat Pulldown'))
       ) as plans_with_both
  from public.workouts w
 where w.exercise_plan is not null
   and exists (select 1 from jsonb_array_elements(w.exercise_plan) e
                where e ->> 'exercise_id' = (select id::text from public.exercises
                                              where owner_id is null and name = 'Lat Pulldown'));

-- 4) Тренування, де є ОБИДВІ вправи в підходах — можливий конфлікт
--    unique(workout_id, exercise_id, set_number): перенесені підходи
--    отримають номери після max(set_number) нової вправи.
with old as (
  select id from public.exercises where owner_id is null and name = 'Lat Pulldown'
), new as (
  select id from public.exercises where owner_id is null and name = 'Wide-Grip Lat Pulldown'
)
select w.id as workout_id, w.name, w.status, w.started_at,
       count(*) filter (where ws.exercise_id = (select id from old)) as old_sets,
       count(*) filter (where ws.exercise_id = (select id from new)) as new_sets,
       max(ws.set_number) filter (where ws.exercise_id = (select id from new)) as new_max_set
  from public.workouts w
  join public.workout_sets ws on ws.workout_id = w.id
 where ws.exercise_id in ((select id from old), (select id from new))
 group by w.id
having count(*) filter (where ws.exercise_id = (select id from old)) > 0
   and count(*) filter (where ws.exercise_id = (select id from new)) > 0
 order by w.started_at;

-- 5) Інші FK на exercises (очікується лише program_exercises і workout_sets)
select c.conrelid::regclass as table_name, a.attname as column_name, c.conname
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
 where c.contype = 'f'
   and c.confrelid = 'public.exercises'::regclass
 order by 1;

-- 6) Конфлікт нової назви для перейменування "Triceps Pushdown"
--    (unique (coalesce(owner_id, 0…0), lower(name))) — має бути 0 рядків
--    серед системних, якщо "Triceps Pushdown" ще не перейменовано.
select e.id, e.name, e.owner_id
  from public.exercises e
 where e.owner_id is null
   and lower(e.name) = lower('Straight-Bar Triceps Pushdown');
