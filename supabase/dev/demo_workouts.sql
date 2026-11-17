-- =====================================================================
-- GainStep — ДЕМО-ДАНІ для перевірки дашборду (лише для розробки!)
--
-- Як користуватися:
--   1. Впиши свій email у змінну v_email нижче.
--   2. У користувача має бути пройдений онбординг (активна програма).
--   3. Supabase Dashboard → SQL Editor → встав увесь файл → Run.
--
-- Що робить: вставляє 10 завершених тренувань за останні ~5 тижнів,
-- по черзі днів активної програми, з виконаними підходами
-- (наприклад, Bench Press 55 → 62.5 кг, 3–4 підходи по 8–12 повторень).
-- Повторний запуск додасть ще 10 тренувань — спершу запусти clear_demo.sql.
-- =====================================================================
do $$
declare
  v_email     text := 'you@example.com';  -- ← впиши свій email

  v_user      uuid;
  v_program   uuid;
  v_days      uuid[];
  v_day_names text[];
  v_day_count int;
  v_day       uuid;
  v_occ       int;          -- котрий раз виконується цей день (0, 1, 2…)
  v_workout   uuid;
  v_start     timestamptz;
  v_weight    numeric;
  v_reps      int;
  ex          record;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'User with email % not found', v_email;
  end if;

  select active_program_id into v_program from public.profiles where id = v_user;
  if v_program is null then
    raise exception 'User % has no active program — finish onboarding first', v_email;
  end if;

  select array_agg(id order by position), array_agg(name order by position)
    into v_days, v_day_names
  from public.program_days
  where program_id = v_program;
  v_day_count := coalesce(array_length(v_days, 1), 0);
  if v_day_count = 0 then
    raise exception 'Active program has no days';
  end if;

  for i in 0..9 loop
    v_day := v_days[(i % v_day_count) + 1];
    v_occ := i / v_day_count;
    -- кожні 3.5 дні, починаючи за 33 дні до сьогодні; останнє — ~1–2 дні тому
    v_start := date_trunc('day', now()) - interval '33 days'
               + i * interval '84 hours' + interval '15 hours';

    insert into public.workouts
      (user_id, program_day_id, name, status, started_at, finished_at)
    values
      (v_user, v_day, v_day_names[(i % v_day_count) + 1], 'completed',
       v_start, v_start + interval '65 minutes')
    returning id into v_workout;

    for ex in
      select pe.exercise_id, pe.position, pe.target_sets, pe.rep_min, pe.rep_max,
             e.name, e.equipment, e.weight_increment
      from public.program_exercises pe
      join public.exercises e on e.id = pe.exercise_id
      where pe.program_day_id = v_day
      order by pe.position
    loop
      -- стартова вага: для базових вправ — реалістичні числа, інакше за обладнанням
      v_weight := case ex.name
          when 'Bench Press'       then 55
          when 'Back Squat'        then 70
          when 'Deadlift'          then 90
          when 'Overhead Press'    then 35
          when 'Barbell Row'       then 50
          when 'Romanian Deadlift' then 60
          else case ex.equipment
            when 'barbell'    then 40
            when 'dumbbell'   then 14
            when 'machine'    then 45
            when 'cable'      then 25
            when 'kettlebell' then 12
            else 0               -- власна вага
          end
        end
        + v_occ * ex.weight_increment;  -- прогресія від тренування до тренування

      for s in 1..ex.target_sets loop
        -- перший підхід ближче до верхньої межі, далі повторень трохи менше
        v_reps := greatest(ex.rep_min, ex.rep_max - (s - 1) - (v_occ % 2));

        insert into public.workout_sets
          (workout_id, exercise_id, exercise_position, set_number,
           weight, reps, is_completed, completed_at)
        values
          (v_workout, ex.exercise_id, ex.position, s,
           v_weight, v_reps, true,
           v_start + (ex.position * 12 + s * 3) * interval '1 minute')
        on conflict (workout_id, exercise_id, set_number) do nothing;
      end loop;
    end loop;
  end loop;

  raise notice 'Inserted 10 demo workouts for %', v_email;
end;
$$;
