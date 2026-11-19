-- =====================================================================
-- Ще 13 системних вправ (owner_id = null): тренажери, блоки, лава Скотта.
-- Ідемпотентна: on conflict do nothing (унікальний exercises_owner_name_uniq).
-- =====================================================================

insert into public.exercises (owner_id, name, name_uk, muscle_group, equipment, is_compound, weight_increment, description)
values
  -- Груди
  (null, 'Incline Machine Chest Press', 'Жим від грудей у тренажері під нахилом', 'chest', 'machine', true,  2.5, 'Жим від грудей у тренажері з похилою спинкою.'),
  (null, 'Pec Deck Fly',                'Зведення рук у тренажері «метелик»',     'chest', 'machine', false, 2.5, 'Зведення рук перед грудьми в тренажері «метелик».'),
  -- Спина
  (null, 'Wide-Grip Lat Pulldown',      'Тяга верхнього блока широким хватом',    'back',  'cable',   true,  2.5, 'Тяга верхнього блока до грудей широким хватом.'),
  (null, 'Close-Grip Lat Pulldown',     'Тяга верхнього блока вузьким хватом',    'back',  'cable',   true,  2.5, 'Тяга верхнього блока до грудей вузьким хватом.'),
  (null, 'Cable Row Machine',           'Важільна тяга з тросом',                 'back',  'machine', true,  2.5, 'Тяга в важільному тренажері з тросовим механізмом.'),
  (null, 'Plate-Loaded Row Machine',    'Важільна тяга з дисками',                'back',  'machine', true,  5.0, 'Тяга у важільному тренажері з навішуванням дисків.'),
  -- Плечі
  (null, 'Machine Shoulder Press',      'Жим плечима в тренажері',                'shoulders', 'machine', true,  2.5, 'Жим ручок тренажера вгору сидячи.'),
  (null, 'Machine Lateral Raise',       'Відведення рук у сторони в тренажері',   'shoulders', 'machine', false, 2.5, 'Відведення рук у сторони в тренажері для середніх дельт.'),
  -- Біцепс
  (null, 'Cable Biceps Curl',           'Підйом на біцепс у кросовері',           'biceps', 'cable',   false, 2.5, 'Згинання рук на біцепс з нижнього блока кросовера.'),
  (null, 'Machine Biceps Curl',         'Підйом на біцепс у тренажері',           'biceps', 'machine', false, 2.5, 'Згинання рук на біцепс у важільному тренажері.'),
  (null, 'Preacher Curl',               'Згинання рук на біцепс на лаві Скотта',  'biceps', 'barbell', false, 2.5, 'Ізольоване згинання рук на біцепс з упором на лаві Скотта.'),
  -- Трицепс
  (null, 'Rope Triceps Pushdown',       'Розгинання рук на трицепс з канатною рукояткою',    'triceps', 'cable', false, 2.5, 'Розгинання рук на верхньому блоці кросовера з канатною рукояткою.'),
  (null, 'V-Bar Triceps Pushdown',      'Розгинання рук на трицепс з V-подібною рукояткою',  'triceps', 'cable', false, 2.5, 'Розгинання рук на верхньому блоці кросовера з V-подібною рукояткою (трикутником).')
on conflict do nothing;

notify pgrst, 'reload schema';
