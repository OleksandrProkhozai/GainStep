-- =====================================================================
-- GainStep — довідкові дані: системні вправи та шаблони програм
-- Ідемпотентний: можна запускати повторно.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Системні вправи (owner_id = null)
-- ---------------------------------------------------------------------
insert into public.exercises (owner_id, name, name_uk, muscle_group, equipment, is_compound, weight_increment, description)
values
  -- Груди
  (null, 'Bench Press',              'Жим штанги лежачи', 'chest',      'barbell',    true,  2.5,  'Жим штанги лежачи на горизонтальній лаві.'),
  (null, 'Incline Bench Press',      'Жим штанги на похилій лаві', 'chest',      'barbell',    true,  2.5,  'Жим штанги лежачи на похилій лаві (30–45°).'),
  (null, 'Incline Dumbbell Press',   'Жим гантелей на похилій лаві', 'chest',      'dumbbell',   true,  2.0,  'Жим гантелей на похилій лаві.'),
  (null, 'Dumbbell Fly',             'Розведення гантелей лежачи', 'chest',      'dumbbell',   false, 1.0,  'Розведення гантелей лежачи.'),
  (null, 'Cable Crossover',          'Зведення рук у кросовері', 'chest',      'cable',      false, 5.0,  'Зведення рук у кросовері.'),
  (null, 'Push-up',                  'Віджимання', 'chest',      'bodyweight', true,  2.5,  'Віджимання від підлоги.'),
  (null, 'Dips',                     'Віджимання на брусах', 'chest',      'bodyweight', true,  2.5,  'Віджимання на брусах.'),
  (null, 'Incline Machine Chest Press', 'Жим від грудей у тренажері під нахилом', 'chest', 'machine', true,  5.0, 'Жим від грудей у тренажері з похилою спинкою.'),
  (null, 'Pec Deck Fly',                'Зведення рук у тренажері «метелик»',     'chest', 'machine', false, 5.0, 'Зведення рук перед грудьми в тренажері «метелик».'),
  -- Спина
  (null, 'Deadlift',                 'Станова тяга', 'back',       'barbell',    true,  5.0,  'Станова тяга штанги з підлоги.'),
  (null, 'Barbell Row',              'Тяга штанги в нахилі', 'back',       'barbell',    true,  2.5,  'Тяга штанги в нахилі.'),
  (null, 'Dumbbell Row',             'Тяга гантелі однією рукою', 'back',       'dumbbell',   true,  2.0,  'Тяга гантелі однією рукою в нахилі.'),
  (null, 'Pull-up',                  'Підтягування', 'back',       'bodyweight', true,  2.5,  'Підтягування широким хватом.'),
  (null, 'Seated Cable Row',         'Тяга нижнього блока сидячи', 'back',       'cable',      true,  5.0,  'Тяга нижнього блока сидячи.'),
  (null, 'T-Bar Row',                'Тяга Т-грифа', 'back',       'machine',    true,  5.0,  'Тяга Т-грифа в нахилі.'),
  (null, 'Wide-Grip Lat Pulldown',      'Тяга верхнього блока широким хватом',    'back',  'cable',   true,  5.0, 'Тяга верхнього блока до грудей широким хватом.'),
  (null, 'Close-Grip Lat Pulldown',     'Тяга верхнього блока вузьким хватом',    'back',  'cable',   true,  5.0, 'Тяга верхнього блока до грудей вузьким хватом.'),
  (null, 'Cable Row Machine',           'Важільна тяга з тросом',                 'back',  'machine', true,  5.0, 'Тяга в важільному тренажері з тросовим механізмом.'),
  (null, 'Plate-Loaded Row Machine',    'Важільна тяга з дисками',                'back',  'machine', true,  5.0, 'Тяга у важільному тренажері з навішуванням дисків.'),
  -- Плечі
  (null, 'Overhead Press',           'Жим штанги стоячи', 'shoulders',  'barbell',    true,  2.5,  'Жим штанги стоячи над головою.'),
  (null, 'Dumbbell Shoulder Press',  'Жим гантелей сидячи', 'shoulders',  'dumbbell',   true,  2.0,  'Жим гантелей сидячи над головою.'),
  (null, 'Lateral Raise',            'Махи гантелями в сторони', 'shoulders',  'dumbbell',   false, 1.0,  'Махи гантелями в сторони.'),
  (null, 'Face Pull',                'Тяга канату до обличчя', 'shoulders',  'cable',      false, 5.0,  'Тяга канату до обличчя.'),
  (null, 'Rear Delt Fly',            'Розведення гантелей у нахилі', 'shoulders',  'machine',    false, 5.0,  'Зворотні розведення в тренажері.'),
  (null, 'Machine Shoulder Press',      'Жим плечима в тренажері',                'shoulders', 'machine', true,  5.0, 'Жим ручок тренажера вгору сидячи.'),
  (null, 'Machine Lateral Raise',       'Відведення рук у сторони в тренажері',   'shoulders', 'machine', false, 5.0, 'Відведення рук у сторони в тренажері для середніх дельт.'),
  -- Біцепс
  (null, 'Barbell Curl',             'Підйом штанги на біцепс', 'biceps',     'barbell',    false, 2.5,  'Підйом штанги на біцепс стоячи.'),
  (null, 'Dumbbell Curl',            'Підйом гантелей на біцепс', 'biceps',     'dumbbell',   false, 1.0,  'Підйом гантелей на біцепс.'),
  (null, 'Hammer Curl',              'Молотки з гантелями', 'biceps',     'dumbbell',   false, 1.0,  'Молоткові згинання з гантелями.'),
  (null, 'Cable Biceps Curl',           'Підйом на біцепс у кросовері',           'biceps', 'cable',   false, 5.0, 'Згинання рук на біцепс з нижнього блока кросовера.'),
  (null, 'Machine Biceps Curl',         'Підйом на біцепс у тренажері',           'biceps', 'machine', false, 5.0, 'Згинання рук на біцепс у важільному тренажері.'),
  (null, 'Preacher Curl',               'Згинання рук на біцепс на лаві Скотта',  'biceps', 'barbell', false, 2.5, 'Ізольоване згинання рук на біцепс з упором на лаві Скотта.'),
  -- Трицепс
  (null, 'Straight-Bar Triceps Pushdown', 'Розгинання рук на трицепс з прямою рукояткою', 'triceps', 'cable', false, 5.0, 'Розгинання рук на верхньому блоці кросовера з прямою рукояткою.'),
  (null, 'Skull Crusher',            'Французький жим лежачи', 'triceps',    'barbell',    false, 2.5,  'Французький жим лежачи.'),
  (null, 'Overhead Triceps Extension','Розгинання гантелі з-за голови', 'triceps',   'dumbbell',   false, 1.0,  'Розгинання гантелі з-за голови.'),
  (null, 'Rope Triceps Pushdown',       'Розгинання рук на трицепс з канатною рукояткою',    'triceps', 'cable', false, 5.0, 'Розгинання рук на верхньому блоці кросовера з канатною рукояткою.'),
  (null, 'V-Bar Triceps Pushdown',      'Розгинання рук на трицепс з V-подібною рукояткою',  'triceps', 'cable', false, 5.0, 'Розгинання рук на верхньому блоці кросовера з V-подібною рукояткою (трикутником).'),
  -- Квадрицепс
  (null, 'Back Squat',               'Присідання зі штангою', 'quads',      'barbell',    true,  5.0,  'Присідання зі штангою на спині.'),
  (null, 'Front Squat',              'Фронтальні присідання', 'quads',      'barbell',    true,  2.5,  'Присідання зі штангою на грудях.'),
  (null, 'Leg Press',                'Жим ногами', 'quads',      'machine',    true,  5.0,  'Жим ногами в тренажері.'),
  (null, 'Bulgarian Split Squat',    'Болгарські присідання', 'quads',      'dumbbell',   true,  2.0,  'Болгарські випади з гантелями.'),
  (null, 'Leg Extension',            'Розгинання ніг у тренажері', 'quads',      'machine',    false, 5.0,  'Розгинання ніг сидячи.'),
  -- Задня поверхня стегна / сідниці
  (null, 'Romanian Deadlift',        'Румунська тяга', 'hamstrings', 'barbell',    true,  2.5,  'Румунська тяга з прямими ногами.'),
  (null, 'Lying Leg Curl',           'Згинання ніг лежачи', 'hamstrings', 'machine',    false, 5.0,  'Згинання ніг лежачи.'),
  (null, 'Hip Thrust',               'Ягідичний міст зі штангою', 'glutes',     'barbell',    true,  5.0,  'Сідничний міст зі штангою.'),
  (null, 'Walking Lunge',            'Випади в ходьбі', 'glutes',     'dumbbell',   true,  2.0,  'Випади в русі з гантелями.'),
  -- Литки
  (null, 'Standing Calf Raise',      'Підйоми на носки стоячи', 'calves',     'machine',    false, 5.0,  'Підйоми на носки стоячи.'),
  (null, 'Seated Calf Raise',        'Підйоми на носки сидячи', 'calves',     'machine',    false, 5.0,  'Підйоми на носки сидячи.'),
  -- Прес / кор
  (null, 'Plank',                    'Планка', 'core',       'bodyweight', false, 2.5,  'Планка на передпліччях (повтори = секунди).'),
  (null, 'Hanging Leg Raise',        'Підйоми ніг у висі', 'core',       'bodyweight', false, 2.5,  'Підйом ніг у висі на турніку.'),
  (null, 'Cable Crunch',             'Скручування на блоці', 'core',       'cable',      false, 5.0,  'Скручування на верхньому блоці.'),
  (null, 'Kettlebell Swing',         'Махи гирею', 'glutes',     'kettlebell', true,  4.0,  'Махи гирею двома руками.')
on conflict do nothing;

-- Повторний запуск seed на базі без перекладів: дописуємо name_uk.
update public.exercises e set name_uk = v.name_uk
from (values
  ('Bench Press', 'Жим штанги лежачи'),
  ('Incline Bench Press', 'Жим штанги на похилій лаві'),
  ('Incline Dumbbell Press', 'Жим гантелей на похилій лаві'),
  ('Dumbbell Fly', 'Розведення гантелей лежачи'),
  ('Cable Crossover', 'Зведення рук у кросовері'),
  ('Push-up', 'Віджимання'),
  ('Dips', 'Віджимання на брусах'),
  ('Deadlift', 'Станова тяга'),
  ('Barbell Row', 'Тяга штанги в нахилі'),
  ('Dumbbell Row', 'Тяга гантелі однією рукою'),
  ('Pull-up', 'Підтягування'),
  ('Seated Cable Row', 'Тяга нижнього блока сидячи'),
  ('T-Bar Row', 'Тяга Т-грифа'),
  ('Overhead Press', 'Жим штанги стоячи'),
  ('Dumbbell Shoulder Press', 'Жим гантелей сидячи'),
  ('Lateral Raise', 'Махи гантелями в сторони'),
  ('Face Pull', 'Тяга канату до обличчя'),
  ('Rear Delt Fly', 'Розведення гантелей у нахилі'),
  ('Barbell Curl', 'Підйом штанги на біцепс'),
  ('Dumbbell Curl', 'Підйом гантелей на біцепс'),
  ('Hammer Curl', 'Молотки з гантелями'),
  ('Straight-Bar Triceps Pushdown', 'Розгинання рук на трицепс з прямою рукояткою'),
  ('Skull Crusher', 'Французький жим лежачи'),
  ('Overhead Triceps Extension', 'Розгинання гантелі з-за голови'),
  ('Back Squat', 'Присідання зі штангою'),
  ('Front Squat', 'Фронтальні присідання'),
  ('Leg Press', 'Жим ногами'),
  ('Bulgarian Split Squat', 'Болгарські присідання'),
  ('Leg Extension', 'Розгинання ніг у тренажері'),
  ('Romanian Deadlift', 'Румунська тяга'),
  ('Lying Leg Curl', 'Згинання ніг лежачи'),
  ('Hip Thrust', 'Ягідичний міст зі штангою'),
  ('Walking Lunge', 'Випади в ходьбі'),
  ('Standing Calf Raise', 'Підйоми на носки стоячи'),
  ('Seated Calf Raise', 'Підйоми на носки сидячи'),
  ('Plank', 'Планка'),
  ('Hanging Leg Raise', 'Підйоми ніг у висі'),
  ('Cable Crunch', 'Скручування на блоці'),
  ('Kettlebell Swing', 'Махи гирею')
) as v(name, name_uk)
where e.owner_id is null and e.name = v.name and e.name_uk is distinct from v.name_uk;

-- ---------------------------------------------------------------------
-- Шаблони програм (owner_id = null) з фіксованими id.
-- Те саме, що міграція 20261119000002_better_templates.sql.
-- ---------------------------------------------------------------------
insert into public.programs (id, owner_id, name, name_uk, description, description_uk, days_per_week, level)
values
  ('10000000-0000-0000-0000-000000000001', null, 'Full Body', 'Все тіло',
   'Whole body every session, 3× a week. Alternate days A and B. Best for beginners.',
   'Усе тіло за одне тренування, 3 рази на тиждень. Дні A і B чергуються. Найкраще для початківців.',
   3, 'beginner'),
  ('10000000-0000-0000-0000-000000000002', null, 'Upper / Lower', 'Верх / Низ',
   'Upper and lower body on alternate days, 4× a week. Each muscle twice a week.',
   'Верх і низ тіла по черзі, 4 рази на тиждень. Кожен м''яз — двічі на тиждень.',
   4, 'beginner'),
  ('10000000-0000-0000-0000-000000000003', null, 'Push Pull Legs', 'Жим / Тяга / Ноги',
   'Push, pull and legs. Run 3× a week or twice through for 6× a week.',
   'Жими, тяги, ноги. 3 тренування на тиждень або двічі по колу — 6.',
   6, 'intermediate')
on conflict (id) do update
  set name           = excluded.name,
      name_uk        = excluded.name_uk,
      description    = excluded.description,
      description_uk = excluded.description_uk,
      days_per_week  = excluded.days_per_week,
      level          = excluded.level;

-- Дні шаблонів: позиції у дві фази (unique (program_id, position)), upsert за id.
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
-- Кількість рядків не змінилась після злиття "Lat Pulldown" → "Wide-Grip
-- Lat Pulldown" (20261127000001): у кожному дні вправа лише замінена.
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
    ('20000000-0000-0000-0000-000000000101', 2, 'Wide-Grip Lat Pulldown',     3, 8,  12, 120),
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
    ('20000000-0000-0000-0000-000000000201', 3, 'Wide-Grip Lat Pulldown',     3, 8,  12, 120),
    ('20000000-0000-0000-0000-000000000201', 4, 'Barbell Curl',               2, 8,  12, 90),
    ('20000000-0000-0000-0000-000000000201', 5, 'Straight-Bar Triceps Pushdown', 2, 10, 15, 60),
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
      using hint = 'Run 20261119000001_more_exercises.sql and 20261127000001_merge_lat_pulldown.sql first.';
  end if;
end;
$$;
