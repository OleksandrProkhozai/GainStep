-- =====================================================================
-- Українська мова інтерфейсу:
--   profiles.locale, українські назви системних вправ і шаблонів,
--   clone_program(template_id, p_locale).
-- Ідемпотентна: можна запускати повторно.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Мова користувача
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists locale text not null default 'en';

alter table public.profiles
  drop constraint if exists profiles_locale_check;
alter table public.profiles
  add constraint profiles_locale_check check (locale in ('en', 'uk'));

-- ---------------------------------------------------------------------
-- 2. Українські назви: системні вправи, шаблони програм і їхні дні.
-- Лише для показу; власні дані користувача не перекладаються.
-- ---------------------------------------------------------------------
alter table public.exercises     add column if not exists name_uk text;
alter table public.programs      add column if not exists name_uk text;
alter table public.program_days  add column if not exists name_uk text;

update public.exercises e
   set name_uk = v.name_uk
  from (values
    ('Bench Press',                'Жим штанги лежачи'),
    ('Incline Bench Press',        'Жим штанги на похилій лаві'),
    ('Incline Dumbbell Press',     'Жим гантелей на похилій лаві'),
    ('Dumbbell Fly',               'Розведення гантелей лежачи'),
    ('Cable Crossover',            'Зведення рук у кросовері'),
    ('Push-up',                    'Віджимання'),
    ('Dips',                       'Віджимання на брусах'),
    ('Deadlift',                   'Станова тяга'),
    ('Barbell Row',                'Тяга штанги в нахилі'),
    ('Dumbbell Row',               'Тяга гантелі однією рукою'),
    ('Pull-up',                    'Підтягування'),
    ('Lat Pulldown',               'Тяга верхнього блока'),
    ('Seated Cable Row',           'Тяга нижнього блока сидячи'),
    ('T-Bar Row',                  'Тяга Т-грифа'),
    ('Overhead Press',             'Жим штанги стоячи'),
    ('Dumbbell Shoulder Press',    'Жим гантелей сидячи'),
    ('Lateral Raise',              'Махи гантелями в сторони'),
    ('Face Pull',                  'Тяга канату до обличчя'),
    ('Rear Delt Fly',              'Розведення гантелей у нахилі'),
    ('Barbell Curl',               'Підйом штанги на біцепс'),
    ('Dumbbell Curl',              'Підйом гантелей на біцепс'),
    ('Hammer Curl',                'Молотки з гантелями'),
    ('Triceps Pushdown',           'Розгинання рук на блоці'),
    ('Skull Crusher',              'Французький жим лежачи'),
    ('Overhead Triceps Extension', 'Розгинання гантелі з-за голови'),
    ('Back Squat',                 'Присідання зі штангою'),
    ('Front Squat',                'Фронтальні присідання'),
    ('Leg Press',                  'Жим ногами'),
    ('Bulgarian Split Squat',      'Болгарські присідання'),
    ('Leg Extension',              'Розгинання ніг у тренажері'),
    ('Romanian Deadlift',          'Румунська тяга'),
    ('Lying Leg Curl',             'Згинання ніг лежачи'),
    ('Hip Thrust',                 'Ягідичний міст зі штангою'),
    ('Walking Lunge',              'Випади в ходьбі'),
    ('Standing Calf Raise',        'Підйоми на носки стоячи'),
    ('Seated Calf Raise',          'Підйоми на носки сидячи'),
    ('Plank',                      'Планка'),
    ('Hanging Leg Raise',          'Підйоми ніг у висі'),
    ('Cable Crunch',               'Скручування на блоці'),
    ('Kettlebell Swing',           'Махи гирею')
  ) as v(name, name_uk)
 where e.owner_id is null
   and e.name = v.name;

update public.programs set name_uk = 'Все тіло'
 where id = '10000000-0000-0000-0000-000000000001' and owner_id is null;
update public.programs set name_uk = 'Верх / Низ'
 where id = '10000000-0000-0000-0000-000000000002' and owner_id is null;
update public.programs set name_uk = 'Жим / Тяга / Ноги'
 where id = '10000000-0000-0000-0000-000000000003' and owner_id is null;

update public.program_days d
   set name_uk = v.name_uk
  from (values
    ('20000000-0000-0000-0000-000000000101'::uuid, 'Все тіло A'),
    ('20000000-0000-0000-0000-000000000102'::uuid, 'Все тіло B'),
    ('20000000-0000-0000-0000-000000000201'::uuid, 'Верх'),
    ('20000000-0000-0000-0000-000000000202'::uuid, 'Низ'),
    ('20000000-0000-0000-0000-000000000301'::uuid, 'Жим'),
    ('20000000-0000-0000-0000-000000000302'::uuid, 'Тяга'),
    ('20000000-0000-0000-0000-000000000303'::uuid, 'Ноги')
  ) as v(id, name_uk)
 where d.id = v.id;

-- ---------------------------------------------------------------------
-- 3. clone_program(template_id, p_locale): копія бере name_uk, якщо
-- p_locale = 'uk' і переклад є. Далі це звичайні дані користувача.
-- Стару сигнатуру (uuid) прибираємо, щоб не було двох перевантажень.
-- ---------------------------------------------------------------------
drop function if exists public.clone_program(uuid);

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
         p.description, p.days_per_week, p.id
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
