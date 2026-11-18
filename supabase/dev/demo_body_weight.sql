-- =====================================================================
-- GainStep — ДЕМО-ДАНІ ваги тіла (лише для розробки!)
--
-- Як користуватися:
--   1. Впиши свій email у змінну v_email нижче.
--   2. Supabase Dashboard → SQL Editor → встав увесь файл → Run.
--
-- Що робить: додає записи ваги приблизно через день за останні 60 днів
-- (31 запис) з плавним трендом 71.5 → 73.5 кг і коливаннями ±0.3 кг.
-- Один запис на день: якщо на дату вже є запис — він оновлюється (upsert),
-- тож скрипт можна запускати повторно. Прибрати — clear_demo_body_weight.sql.
-- =====================================================================
do $$
declare
  v_email    text := 'you@example.com';  -- ← впиши свій email

  v_user     uuid;
  v_today    date := (now() at time zone 'Europe/Kiev')::date;
  v_days     int  := 60;
  v_start_kg numeric := 71.5;
  v_end_kg   numeric := 73.5;
  v_count    int := 0;
  d          int;
  v_weight   numeric;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'User with email % not found', v_email;
  end if;

  -- d — скільки днів тому: 60, 58, …, 2, 0 (сьогодні)
  for d in reverse v_days..0 by 2 loop
    v_weight := round(
      v_start_kg + (v_end_kg - v_start_kg) * (v_days - d)::numeric / v_days
        + (random() * 0.6 - 0.3)::numeric,
      1
    );

    insert into public.body_weight_entries (user_id, weight, recorded_on)
    values (v_user, v_weight, v_today - d)
    on conflict (user_id, recorded_on) do update set weight = excluded.weight;

    v_count := v_count + 1;
  end loop;

  raise notice 'Upserted % body weight entries for %', v_count, v_email;
end;
$$;
