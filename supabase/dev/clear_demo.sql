-- =====================================================================
-- GainStep — ВИДАЛЕННЯ демо-даних (лише для розробки!)
--
-- Як користуватися:
--   1. Впиши свій email у змінну v_email нижче (той самий, що в demo_workouts.sql).
--   2. Supabase Dashboard → SQL Editor → встав увесь файл → Run.
--
-- УВАГА: видаляє ВСІ тренування цього користувача (не лише демо).
-- Підходи (workout_sets) видаляються каскадно.
-- =====================================================================
do $$
declare
  v_email   text := 'you@example.com';  -- ← впиши свій email
  v_user    uuid;
  v_deleted int;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'User with email % not found', v_email;
  end if;

  delete from public.workouts where user_id = v_user;
  get diagnostics v_deleted = row_count;

  raise notice 'Deleted % workouts for %', v_deleted, v_email;
end;
$$;
