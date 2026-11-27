-- =====================================================================
-- 1) Злиття дубліката: системна "Lat Pulldown" / "Тяга верхнього блока"
--    (без уточнення хвата) → "Wide-Grip Lat Pulldown" / "Тяга верхнього
--    блока широким хватом". Історія тренувань, програми (і шаблони, і
--    програми користувачів), склад тренувань і рекорди переносяться на
--    нову вправу; стара видаляється.
-- 2) Перейменування системної "Triceps Pushdown" / "Розгинання рук на
--    блоці" → "Straight-Bar Triceps Pushdown" (канатна й V-подібна лишаються).
--
-- Перевірка до / після: supabase/checks/lat_pulldown_merge_check.sql.
-- Одна транзакція: будь-яка помилка (raise exception) — нічого не змінено.
-- Ідемпотентна: якщо "Lat Pulldown" вже немає — злиття пропускається.
--
-- Посилання на exercises (FK on delete restrict): program_exercises,
-- workout_sets; плюс jsonb workouts.exercise_plan. Інші FK, якщо з'являться,
-- переносяться загальним update (крок d) і перевіряються перед видаленням (e).
-- =====================================================================

begin;

do $$
declare
  v_old   uuid;
  v_new   uuid;
  v_days  uuid[];
  v_n     bigint;
  v_fk    record;
  v_left  bigint := 0;
begin
  select id into v_old from public.exercises where owner_id is null and name = 'Lat Pulldown';
  select id into v_new from public.exercises where owner_id is null and name = 'Wide-Grip Lat Pulldown';

  if v_old is null then
    raise notice 'Lat Pulldown: системної вправи вже немає — злиття пропущено';
    return;
  end if;
  if v_new is null then
    raise exception 'Wide-Grip Lat Pulldown: системну вправу не знайдено — нічого не змінено'
      using hint = 'Спершу 20261119000001_more_exercises.sql.';
  end if;

  -- Незавершене тренування зі старою вправою: його стан живе на пристрої
  -- (localStorage) зі старим id — синхронізація після видалення вправи
  -- падала б. Спершу завершіть або скасуйте його.
  if exists (
    select 1 from public.workouts w
     where w.status = 'in_progress'
       and (exists (select 1 from public.workout_sets ws where ws.workout_id = w.id and ws.exercise_id = v_old)
            or (w.exercise_plan is not null
                and w.exercise_plan @> jsonb_build_array(jsonb_build_object('exercise_id', v_old::text))))
  ) then
    raise exception 'Є незавершене тренування з "Lat Pulldown" — завершіть або скасуйте його й запустіть знову. Нічого не змінено.';
  end if;

  -- ── a) workout_sets ────────────────────────────────────────────────
  -- Якщо в тренуванні вже є підходи нової вправи — перенесені йдуть після
  -- них (set_number = max + n) і стають на позицію нової вправи, інакше
  -- лишаються 1..n на своїй позиції. unique(workout_id, exercise_id,
  -- set_number) не порушується: нові номери більші за всі наявні.
  with per_workout as (
    select ws.workout_id,
           max(ws.set_number)        filter (where ws.exercise_id = v_new) as new_max,
           min(ws.exercise_position) filter (where ws.exercise_id = v_new) as new_pos
      from public.workout_sets ws
     where ws.exercise_id in (v_old, v_new)
     group by ws.workout_id
  ), moved as (
    select ws.id,
           (coalesce(p.new_max, 0)
             + row_number() over (partition by ws.workout_id order by ws.set_number))::smallint as set_number,
           coalesce(p.new_pos, ws.exercise_position) as exercise_position
      from public.workout_sets ws
      join per_workout p on p.workout_id = ws.workout_id
     where ws.exercise_id = v_old
  )
  update public.workout_sets ws
     set exercise_id       = v_new,
         set_number        = m.set_number,
         exercise_position = m.exercise_position
    from moved m
   where ws.id = m.id;
  get diagnostics v_n = row_count;
  raise notice 'workout_sets: перенесено % підходів', v_n;

  -- ── b) program_exercises ───────────────────────────────────────────
  -- Програми, яких торкаємось: version (updated_at) змінюється, тож
  -- відкритий редактор зі старою чернеткою отримає конфлікт, а не помилку.
  update public.programs p
     set updated_at = now()
   where p.id in (select d.program_id
                    from public.program_exercises pe
                    join public.program_days d on d.id = pe.program_day_id
                   where pe.exercise_id = v_old);

  -- Дні, де вже є нова вправа: рядок старої видаляємо (параметри нової
  -- лишаються), позиції дня потім ущільнюємо.
  with deleted as (
    delete from public.program_exercises pe
     where pe.exercise_id = v_old
       and exists (select 1 from public.program_exercises x
                    where x.program_day_id = pe.program_day_id
                      and x.exercise_id = v_new)
    returning pe.program_day_id
  )
  select coalesce(array_agg(distinct program_day_id), '{}') into v_days from deleted;
  raise notice 'program_exercises: видалено % дублікатів (дні з обома вправами)', cardinality(v_days);

  update public.program_exercises set exercise_id = v_new where exercise_id = v_old;
  get diagnostics v_n = row_count;
  raise notice 'program_exercises: замінено % рядків', v_n;

  -- Ущільнення позицій у дві фази, як у save_program: unique(program_day_id, position).
  if cardinality(v_days) > 0 then
    update public.program_exercises
       set position = position + 1000
     where program_day_id = any (v_days);

    update public.program_exercises pe
       set position = r.rn - 1
      from (select id,
                   row_number() over (partition by program_day_id order by position) as rn
              from public.program_exercises
             where program_day_id = any (v_days)) r
     where pe.id = r.id;
  end if;

  -- ── c) workouts.exercise_plan ──────────────────────────────────────
  -- Заміна id у кожному елементі; якщо після заміни вправа в плані двічі —
  -- лишається перше входження (порядок складу зберігається).
  update public.workouts w
     set exercise_plan = (
       select coalesce(jsonb_agg(x.elem order by x.ord), '[]'::jsonb)
         from (
           select distinct on (coalesce(e.elem ->> 'exercise_id', 'ord:' || e.ord)) e.elem, e.ord
             from (
               select case when t.elem ->> 'exercise_id' = v_old::text
                           then jsonb_set(t.elem, '{exercise_id}', to_jsonb(v_new::text))
                           else t.elem
                      end as elem,
                      t.ord
                 from jsonb_array_elements(w.exercise_plan) with ordinality as t(elem, ord)
             ) e
            order by coalesce(e.elem ->> 'exercise_id', 'ord:' || e.ord), e.ord
         ) x
     )
   where w.exercise_plan is not null
     and w.exercise_plan @> jsonb_build_array(jsonb_build_object('exercise_id', v_old::text));
  get diagnostics v_n = row_count;
  raise notice 'workouts.exercise_plan: оновлено % тренувань', v_n;

  -- ── d) Інші FK на exercises (зараз таких немає) ────────────────────
  for v_fk in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f'
       and c.confrelid = 'public.exercises'::regclass
       and c.conrelid not in ('public.program_exercises'::regclass, 'public.workout_sets'::regclass)
  loop
    execute format('update %s set %I = $1 where %I = $2', v_fk.tbl, v_fk.col, v_fk.col) using v_new, v_old;
    get diagnostics v_n = row_count;
    raise notice '%.%: замінено % рядків', v_fk.tbl, v_fk.col, v_n;
  end loop;

  -- ── e) Перевірка: на стару вправу не лишилось жодного посилання ────
  for v_fk in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f'
       and c.confrelid = 'public.exercises'::regclass
  loop
    execute format('select count(*) from %s where %I = $1', v_fk.tbl, v_fk.col) into v_n using v_old;
    v_left := v_left + v_n;
  end loop;
  select v_left + count(*) into v_left
    from public.workouts w
   where w.exercise_plan @> jsonb_build_array(jsonb_build_object('exercise_id', v_old::text));
  if v_left > 0 then
    raise exception 'Після переносу лишилось % посилань на "Lat Pulldown" — нічого не змінено', v_left;
  end if;

  -- ── f) Видалення старої вправи ─────────────────────────────────────
  delete from public.exercises where id = v_old;
  raise notice 'Lat Pulldown (%) злито з Wide-Grip Lat Pulldown (%)', v_old, v_new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) "Triceps Pushdown" → "Straight-Bar Triceps Pushdown" (не видаляємо:
--    історія й програми лишаються на тому самому id). Унікальність назв —
--    exercises_owner_name_uniq (coalesce(owner_id, 0…0), lower(name)).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.exercises where owner_id is null and name = 'Triceps Pushdown') then
    if exists (select 1 from public.exercises
                where owner_id is null and lower(name) = lower('Straight-Bar Triceps Pushdown')) then
      raise exception 'Системна "Straight-Bar Triceps Pushdown" вже існує поряд з "Triceps Pushdown" — нічого не змінено';
    end if;
    update public.exercises
       set name = 'Straight-Bar Triceps Pushdown'
     where owner_id is null and name = 'Triceps Pushdown';
  end if;

  -- Назва українською й опис — і при повторному запуску.
  update public.exercises
     set name_uk     = 'Розгинання рук на трицепс з прямою рукояткою',
         description = 'Розгинання рук на верхньому блоці кросовера з прямою рукояткою.'
   where owner_id is null and name = 'Straight-Bar Triceps Pushdown';
end;
$$;

commit;

notify pgrst, 'reload schema';
