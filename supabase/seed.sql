-- =====================================================================
-- GainStep — довідкові дані: системні вправи та шаблони програм
-- Ідемпотентний: можна запускати повторно.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Системні вправи (owner_id = null)
-- ---------------------------------------------------------------------
insert into public.exercises (owner_id, name, muscle_group, equipment, is_compound, weight_increment, description)
values
  -- Груди
  (null, 'Bench Press',              'chest',      'barbell',    true,  2.5,  'Жим штанги лежачи на горизонтальній лаві.'),
  (null, 'Incline Bench Press',      'chest',      'barbell',    true,  2.5,  'Жим штанги лежачи на похилій лаві (30–45°).'),
  (null, 'Incline Dumbbell Press',   'chest',      'dumbbell',   true,  2.0,  'Жим гантелей на похилій лаві.'),
  (null, 'Dumbbell Fly',             'chest',      'dumbbell',   false, 1.0,  'Розведення гантелей лежачи.'),
  (null, 'Cable Crossover',          'chest',      'cable',      false, 2.5,  'Зведення рук у кросовері.'),
  (null, 'Push-up',                  'chest',      'bodyweight', true,  2.5,  'Віджимання від підлоги.'),
  (null, 'Dips',                     'chest',      'bodyweight', true,  2.5,  'Віджимання на брусах.'),
  -- Спина
  (null, 'Deadlift',                 'back',       'barbell',    true,  5.0,  'Станова тяга штанги з підлоги.'),
  (null, 'Barbell Row',              'back',       'barbell',    true,  2.5,  'Тяга штанги в нахилі.'),
  (null, 'Dumbbell Row',             'back',       'dumbbell',   true,  2.0,  'Тяга гантелі однією рукою в нахилі.'),
  (null, 'Pull-up',                  'back',       'bodyweight', true,  2.5,  'Підтягування широким хватом.'),
  (null, 'Lat Pulldown',             'back',       'cable',      true,  2.5,  'Тяга верхнього блока до грудей.'),
  (null, 'Seated Cable Row',         'back',       'cable',      true,  2.5,  'Тяга нижнього блока сидячи.'),
  (null, 'T-Bar Row',                'back',       'machine',    true,  2.5,  'Тяга Т-грифа в нахилі.'),
  -- Плечі
  (null, 'Overhead Press',           'shoulders',  'barbell',    true,  2.5,  'Жим штанги стоячи над головою.'),
  (null, 'Dumbbell Shoulder Press',  'shoulders',  'dumbbell',   true,  2.0,  'Жим гантелей сидячи над головою.'),
  (null, 'Lateral Raise',            'shoulders',  'dumbbell',   false, 1.0,  'Махи гантелями в сторони.'),
  (null, 'Face Pull',                'shoulders',  'cable',      false, 2.5,  'Тяга канату до обличчя.'),
  (null, 'Rear Delt Fly',            'shoulders',  'machine',    false, 2.5,  'Зворотні розведення в тренажері.'),
  -- Біцепс
  (null, 'Barbell Curl',             'biceps',     'barbell',    false, 2.5,  'Підйом штанги на біцепс стоячи.'),
  (null, 'Dumbbell Curl',            'biceps',     'dumbbell',   false, 1.0,  'Підйом гантелей на біцепс.'),
  (null, 'Hammer Curl',              'biceps',     'dumbbell',   false, 1.0,  'Молоткові згинання з гантелями.'),
  -- Трицепс
  (null, 'Triceps Pushdown',         'triceps',    'cable',      false, 2.5,  'Розгинання рук на верхньому блоці.'),
  (null, 'Skull Crusher',            'triceps',    'barbell',    false, 2.5,  'Французький жим лежачи.'),
  (null, 'Overhead Triceps Extension','triceps',   'dumbbell',   false, 1.0,  'Розгинання гантелі з-за голови.'),
  -- Квадрицепс
  (null, 'Back Squat',               'quads',      'barbell',    true,  5.0,  'Присідання зі штангою на спині.'),
  (null, 'Front Squat',              'quads',      'barbell',    true,  2.5,  'Присідання зі штангою на грудях.'),
  (null, 'Leg Press',                'quads',      'machine',    true,  5.0,  'Жим ногами в тренажері.'),
  (null, 'Bulgarian Split Squat',    'quads',      'dumbbell',   true,  2.0,  'Болгарські випади з гантелями.'),
  (null, 'Leg Extension',            'quads',      'machine',    false, 2.5,  'Розгинання ніг сидячи.'),
  -- Задня поверхня стегна / сідниці
  (null, 'Romanian Deadlift',        'hamstrings', 'barbell',    true,  2.5,  'Румунська тяга з прямими ногами.'),
  (null, 'Lying Leg Curl',           'hamstrings', 'machine',    false, 2.5,  'Згинання ніг лежачи.'),
  (null, 'Hip Thrust',               'glutes',     'barbell',    true,  5.0,  'Сідничний міст зі штангою.'),
  (null, 'Walking Lunge',            'glutes',     'dumbbell',   true,  2.0,  'Випади в русі з гантелями.'),
  -- Литки
  (null, 'Standing Calf Raise',      'calves',     'machine',    false, 2.5,  'Підйоми на носки стоячи.'),
  (null, 'Seated Calf Raise',        'calves',     'machine',    false, 2.5,  'Підйоми на носки сидячи.'),
  -- Прес / кор
  (null, 'Plank',                    'core',       'bodyweight', false, 2.5,  'Планка на передпліччях (повтори = секунди).'),
  (null, 'Hanging Leg Raise',        'core',       'bodyweight', false, 2.5,  'Підйом ніг у висі на турніку.'),
  (null, 'Cable Crunch',             'core',       'cable',      false, 2.5,  'Скручування на верхньому блоці.'),
  (null, 'Kettlebell Swing',         'glutes',     'kettlebell', true,  4.0,  'Махи гирею двома руками.')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Шаблони програм (owner_id = null) з фіксованими id
-- ---------------------------------------------------------------------
insert into public.programs (id, owner_id, name, description, days_per_week)
values
  ('10000000-0000-0000-0000-000000000001', null, 'Full Body',
   'Все тіло за одне тренування, 3 рази на тиждень. Підходить новачкам.', 3),
  ('10000000-0000-0000-0000-000000000002', null, 'Upper / Lower',
   'Верх і низ тіла по черзі, 4 тренування на тиждень.', 4),
  ('10000000-0000-0000-0000-000000000003', null, 'Push Pull Legs',
   'Жими, тяги, ноги. Класичний спліт для середнього рівня.', 6)
on conflict (id) do nothing;

-- Дні шаблонів
insert into public.program_days (id, program_id, name, position)
values
  -- Full Body
  ('20000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000001', 'Full Body A', 0),
  ('20000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000001', 'Full Body B', 1),
  -- Upper / Lower
  ('20000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000002', 'Upper', 0),
  ('20000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000002', 'Lower', 1),
  -- Push Pull Legs
  ('20000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000003', 'Push', 0),
  ('20000000-0000-0000-0000-000000000302', '10000000-0000-0000-0000-000000000003', 'Pull', 1),
  ('20000000-0000-0000-0000-000000000303', '10000000-0000-0000-0000-000000000003', 'Legs', 2)
on conflict (id) do nothing;

-- Вправи днів: (день, позиція, назва вправи, підходи, мін, макс, відпочинок)
insert into public.program_exercises
  (program_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds)
select v.day_id::uuid, e.id, v.pos, v.sets, v.rmin, v.rmax, v.rest
from (values
  -- Full Body A
  ('20000000-0000-0000-0000-000000000101', 0, 'Back Squat',          3, 5,  8,  180),
  ('20000000-0000-0000-0000-000000000101', 1, 'Bench Press',         3, 5,  8,  180),
  ('20000000-0000-0000-0000-000000000101', 2, 'Barbell Row',         3, 8,  12, 120),
  ('20000000-0000-0000-0000-000000000101', 3, 'Lateral Raise',       3, 10, 15, 60),
  ('20000000-0000-0000-0000-000000000101', 4, 'Plank',               3, 30, 60, 60),
  -- Full Body B
  ('20000000-0000-0000-0000-000000000102', 0, 'Deadlift',            3, 3,  5,  180),
  ('20000000-0000-0000-0000-000000000102', 1, 'Overhead Press',      3, 5,  8,  150),
  ('20000000-0000-0000-0000-000000000102', 2, 'Lat Pulldown',        3, 8,  12, 120),
  ('20000000-0000-0000-0000-000000000102', 3, 'Leg Press',           3, 10, 15, 120),
  ('20000000-0000-0000-0000-000000000102', 4, 'Dumbbell Curl',       2, 10, 15, 60),
  -- Upper
  ('20000000-0000-0000-0000-000000000201', 0, 'Bench Press',         4, 6,  10, 150),
  ('20000000-0000-0000-0000-000000000201', 1, 'Barbell Row',         4, 6,  10, 150),
  ('20000000-0000-0000-0000-000000000201', 2, 'Overhead Press',      3, 8,  12, 120),
  ('20000000-0000-0000-0000-000000000201', 3, 'Lat Pulldown',        3, 8,  12, 90),
  ('20000000-0000-0000-0000-000000000201', 4, 'Triceps Pushdown',    3, 10, 15, 60),
  ('20000000-0000-0000-0000-000000000201', 5, 'Hammer Curl',         3, 10, 15, 60),
  -- Lower
  ('20000000-0000-0000-0000-000000000202', 0, 'Back Squat',          4, 6,  10, 180),
  ('20000000-0000-0000-0000-000000000202', 1, 'Romanian Deadlift',   3, 8,  12, 150),
  ('20000000-0000-0000-0000-000000000202', 2, 'Leg Press',           3, 10, 15, 120),
  ('20000000-0000-0000-0000-000000000202', 3, 'Lying Leg Curl',      3, 10, 15, 60),
  ('20000000-0000-0000-0000-000000000202', 4, 'Standing Calf Raise', 4, 10, 15, 60),
  -- Push
  ('20000000-0000-0000-0000-000000000301', 0, 'Bench Press',         4, 8,  12, 150),
  ('20000000-0000-0000-0000-000000000301', 1, 'Incline Dumbbell Press', 3, 8, 12, 120),
  ('20000000-0000-0000-0000-000000000301', 2, 'Overhead Press',      3, 8,  12, 120),
  ('20000000-0000-0000-0000-000000000301', 3, 'Lateral Raise',       3, 12, 15, 60),
  ('20000000-0000-0000-0000-000000000301', 4, 'Triceps Pushdown',    3, 10, 15, 60),
  -- Pull
  ('20000000-0000-0000-0000-000000000302', 0, 'Deadlift',            3, 5,  8,  180),
  ('20000000-0000-0000-0000-000000000302', 1, 'Pull-up',             3, 6,  10, 120),
  ('20000000-0000-0000-0000-000000000302', 2, 'Seated Cable Row',    3, 8,  12, 90),
  ('20000000-0000-0000-0000-000000000302', 3, 'Face Pull',           3, 12, 15, 60),
  ('20000000-0000-0000-0000-000000000302', 4, 'Barbell Curl',        3, 8,  12, 60),
  -- Legs
  ('20000000-0000-0000-0000-000000000303', 0, 'Back Squat',          4, 6,  10, 180),
  ('20000000-0000-0000-0000-000000000303', 1, 'Romanian Deadlift',   3, 8,  12, 150),
  ('20000000-0000-0000-0000-000000000303', 2, 'Bulgarian Split Squat', 3, 8, 12, 90),
  ('20000000-0000-0000-0000-000000000303', 3, 'Leg Extension',       3, 12, 15, 60),
  ('20000000-0000-0000-0000-000000000303', 4, 'Standing Calf Raise', 4, 10, 15, 60)
) as v(day_id, pos, exercise_name, sets, rmin, rmax, rest)
join public.exercises e on e.owner_id is null and e.name = v.exercise_name
on conflict (program_day_id, position) do nothing;