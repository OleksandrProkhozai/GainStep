-- =====================================================================
-- Склад тренування: workouts.exercise_plan.
--   Впорядкований jsonb-масив вправ тренування:
--   [{ exercise_id, target_sets, rep_min, rep_max, rest_seconds,
--      source: 'program' | 'added' }]
--   Заповнюється при старті тренування з дня програми й оновлюється,
--   коли під час тренування вправи додають або прибирають.
--   null — старі тренування (склад береться з дня програми, як раніше).
-- Доступ — наявна політика workouts_all_own (лише власні тренування).
-- Ідемпотентна: можна запускати повторно.
-- =====================================================================

alter table public.workouts
  add column if not exists exercise_plan jsonb;

alter table public.workouts
  drop constraint if exists workouts_exercise_plan_check;
alter table public.workouts
  add constraint workouts_exercise_plan_check
  check (exercise_plan is null or jsonb_typeof(exercise_plan) = 'array');

notify pgrst, 'reload schema';
