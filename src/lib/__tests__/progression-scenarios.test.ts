/**
 * Сценарії прогресії "як у житті": послідовності тренувань проходять тим самим
 * шляхом, що й у застосунку — рядки workout_sets → groupSessionRows →
 * toExerciseHistory → вправа тренування → getSuggestion / initialSets; ті самі
 * дані — у підсумок (buildWorkoutSummary), Next-чип редактора (nextChip) і
 * дашборд (buildSmartProgression). Логіка алгоритму тут не дублюється.
 */
import { describe, expect, it } from "vitest";

import { buildSmartProgression } from "../dashboard/queries";
import { nextChip, toRecentHistory } from "../programs/next";
import { explainSuggestion } from "../progression-explain";
import { toDisplayWeight, fromDisplayWeight, type WeightUnit } from "../units";
import { getSuggestion, initialSets, previousSet, progressionInput } from "../workout/derive";
import { groupSessionRows, type SessionRow } from "../workout/history";
import { toExerciseHistory, toWorkoutExercise } from "../workout/queries";
import { buildWorkoutSummary } from "../workout/summary";
import { ADDED_EXERCISE_DEFAULTS, type Equipment, type WorkoutExercise } from "../workout/types";

// ───────────── Дані "з бази" ─────────────

type Ex = { id: string; equipment: Equipment; increment: number; ownerId?: string | null };
const BENCH: Ex = { id: "bench", equipment: "barbell", increment: 2.5 };
/** Власна вправа користувача на блоці з кроком 5 кг. */
const MY_CABLE: Ex = { id: "my-cable-row", equipment: "cable", increment: 5, ownerId: "user-1" };
const PUSHUP: Ex = { id: "pushup", equipment: "bodyweight", increment: 2.5 };

let seq = 0;
/** Одне завершене тренування вправи: підходи з однією вагою (кг) і заданими повтореннями. */
function workout(ex: Ex, day: string, weight: number, reps: number[], opts: { completed?: boolean[] } = {}): SessionRow[] {
  const workoutId = `w${++seq}`;
  return reps.map((r, i) => ({
    exerciseId: ex.id,
    workoutId,
    startedAt: `2026-11-${day}T10:00:00.000Z`,
    setNumber: i + 1,
    weight,
    reps: r,
    isCompleted: opts.completed?.[i] ?? true,
  }));
}

/** Рядок exercises (власна вправа — з owner_id). */
const exerciseRow = (ex: Ex) => ({
  id: ex.id,
  name: ex.id,
  name_uk: null,
  muscle_group: "chest" as const,
  equipment: ex.equipment,
  weight_increment: ex.increment,
  image_path: null,
  owner_id: ex.ownerId ?? null,
  is_compound: false,
});

/** Параметри з ПОТОЧНОЇ програми (program_exercises / exercise_plan). */
type Plan = { targetSets: number; repMin: number; repMax: number };
const PLAN_8_12: Plan = { targetSets: 3, repMin: 8, repMax: 12 };

/** Вправа тренування так, як її будує loadWorkout: рядок exercises + план + історія з бази. */
function workoutExercise(ex: Ex, plan: Plan, rows: SessionRow[], source: "program" | "added" = "program"): WorkoutExercise {
  const history = toExerciseHistory(groupSessionRows(rows)).get(ex.id);
  return toWorkoutExercise(exerciseRow(ex), { ...plan, restSeconds: 90, source }, history);
}

/** Рекомендація в одиницях показу (як на екрані). */
const shown = (kg: number | null, unit: WeightUnit = "kg") => (kg === null ? null : toDisplayWeight(kg, unit));

/** Усі місця застосунку для однієї вправи: екран тренування, Next-чип, дашборд. */
function everywhere(ex: Ex, plan: Plan, rows: SessionRow[], unit: WeightUnit = "kg") {
  const exercise = workoutExercise(ex, plan, rows);
  const workoutScreen = getSuggestion(exercise, unit);
  const chip = nextChip(
    { exerciseId: ex.id, equipment: ex.equipment, incrementKg: ex.increment, ...plan },
    toRecentHistory(groupSessionRows(rows)),
    unit,
  );
  const dashboard = buildSmartProgression(
    [{ exerciseId: ex.id, name: ex.id, increment: ex.increment, equipment: ex.equipment, ...plan }],
    groupSessionRows(rows),
    unit,
  );
  return { exercise, workoutScreen, chip, dashboard: dashboard[0]?.suggestion ?? null };
}

// ───────────── Сценарії ─────────────

describe("власна програма 3 × 8–12, жим 60 кг", () => {
  it("12/12/12 → 62.5 кг (усюди однаково)", () => {
    const rows = workout(BENCH, "10", 60, [12, 12, 12]);
    const r = everywhere(BENCH, PLAN_8_12, rows);
    expect(r.workoutScreen).toMatchObject({ action: "increase", weight: 62.5, delta: 2.5 });
    expect(r.chip).toMatchObject({ action: "increase", weightKg: 62.5 });
    expect(r.dashboard).toMatchObject({ action: "increase", weight: 62.5 });
    // Авто-підстановка: вага з підказки, повторення — з низу діапазону.
    expect(initialSets(r.exercise).map((s) => [s.weightKg, s.reps])).toEqual([[62.5, 8], [62.5, 8], [62.5, 8]]);
  });

  it("12/11/10 → 60 кг (так само), повторення — як минулого разу", () => {
    const rows = workout(BENCH, "10", 60, [12, 11, 10]);
    const r = everywhere(BENCH, PLAN_8_12, rows);
    expect(r.workoutScreen).toMatchObject({ action: "same", weight: 60, delta: 0 });
    expect(r.chip).toMatchObject({ action: "same", weightKg: 60 });
    expect(r.dashboard).toMatchObject({ action: "same", weight: 60 });
    expect(initialSets(r.exercise).map((s) => s.reps)).toEqual([12, 11, 10]);
    expect(previousSet(r.exercise, 2)).toMatchObject({ weight: 60, reps: 11 });
  });

  it("7/6/6 один раз → та сама вага; двічі поспіль → 55 кг (−10% до кроку 2.5)", () => {
    const once = workout(BENCH, "10", 60, [7, 6, 6]);
    expect(everywhere(BENCH, PLAN_8_12, once).workoutScreen).toMatchObject({ action: "same", weight: 60 });

    const twice = [...workout(BENCH, "10", 60, [7, 6, 6]), ...workout(BENCH, "13", 60, [7, 6, 6])];
    const r = everywhere(BENCH, PLAN_8_12, twice);
    expect(r.workoutScreen).toMatchObject({ action: "deload", weight: 55, delta: -5 });
    expect(r.chip).toMatchObject({ action: "deload", weightKg: 55 });
    expect(r.dashboard).toMatchObject({ action: "deload", weight: 55 });
  });

  it("підсумок: друге невдале тренування → 'Наступного разу' 55 кг", () => {
    const before = workout(BENCH, "10", 60, [7, 6, 6]);
    const history = toExerciseHistory(groupSessionRows(before)).get(BENCH.id)!;
    const summary = buildWorkoutSummary({
      startedAt: "2026-11-13T10:00:00.000Z",
      finishedAt: "2026-11-13T11:00:00.000Z",
      exercises: [{ exerciseId: BENCH.id, name: "Жим", ...PLAN_8_12, increment: 2.5, equipment: "barbell", ...history }],
      sets: [7, 6, 6].map((reps) => ({ exerciseId: BENCH.id, weight: 60, reps, isCompleted: true })),
      previous: null,
    });
    expect(summary.exercises[0].next).toMatchObject({ action: "deload", weight: 55, today: 60 });
  });
});

describe("правило розвантаження: приклади 3 × 8–12, 60 кг", () => {
  /** Тренування по днях (від найстарішого) → дія й вага на всіх екранах + пояснення. */
  function after(...sessions: number[][]) {
    const rows = sessions.flatMap((reps, i) => workout(BENCH, String(10 + i * 2), 60, reps));
    const r = everywhere(BENCH, PLAN_8_12, rows);
    // Одна функція для всіх місць: екран тренування, Next-чип, дашборд.
    expect(r.chip).toMatchObject({ action: r.workoutScreen.action, weightKg: r.workoutScreen.weight });
    expect(r.dashboard).toMatchObject({ action: r.workoutScreen.action, weight: r.workoutScreen.weight });
    const why = explainSuggestion(progressionInput(r.exercise), r.workoutScreen, "uk");
    return { action: r.workoutScreen.action, weight: r.workoutScreen.weight, why };
  }
  const WARNING = "Якщо повториться наступного разу, буде розвантаження.";

  it("12/12/12 → +крок (62.5)", () => {
    expect(after([12, 12, 12])).toMatchObject({ action: "increase", weight: 62.5 });
  });

  it("12/11/11 → та сама вага, без попередження", () => {
    const r = after([12, 11, 11]);
    expect(r).toMatchObject({ action: "same", weight: 60 });
    expect(r.why).not.toContain(WARNING);
  });

  it("8/8/7 → та сама вага (недобір 1), без попередження", () => {
    const r = after([8, 8, 7]);
    expect(r).toMatchObject({ action: "same", weight: 60 });
    expect(r.why).toContain("Недобір 1 повторення до мінімуму 8 — тримаємо вагу, 60 кг, наступного разу спробуйте добрати.");
    expect(r.why).not.toContain(WARNING);
  });

  it("7/6/6 одне тренування → та сама вага з попередженням", () => {
    const r = after([7, 6, 6]);
    expect(r).toMatchObject({ action: "same", weight: 60 });
    expect(r.why).toContain(`2 підходи по 6 при мінімумі 8 → та сама вага, 60 кг. ${WARNING}`);
  });

  it("7/6/6, потім 6/6/8 → розвантаження 55 кг", () => {
    const r = after([7, 6, 6], [6, 6, 8]);
    expect(r).toMatchObject({ action: "deload", weight: 55 });
    expect(r.why).toContain("Другий раз поспіль сильний недобір → розвантаження −10% → 55 кг.");
  });

  it("6/9/10, потім 6/9/9 → та сама вага (лише один підхід із сильним недобором)", () => {
    const r = after([6, 9, 10], [6, 9, 9]);
    expect(r).toMatchObject({ action: "same", weight: 60 });
    expect(r.why).toContain("Сильний недобір лише в одному підході (6 при мінімумі 8) → та сама вага, 60 кг.");
    expect(r.why).not.toContain(WARNING);
  });

  it("6/6/9 → 10/10/10 → 6/6/9 → та сама вага (невдалі не поспіль), з попередженням", () => {
    const r = after([6, 6, 9], [10, 10, 10], [6, 6, 9]);
    expect(r).toMatchObject({ action: "same", weight: 60 });
    expect(r.why).toContain(WARNING);
  });

  it("межа: рівно repMin − 2 (6/6/12 двічі) → розвантаження", () => {
    expect(after([6, 6, 12], [6, 6, 12])).toMatchObject({ action: "deload", weight: 55 });
  });

  it("межа: рівно repMin − 1 (7/7/7 двічі) → та сама вага", () => {
    expect(after([7, 7, 7], [7, 7, 7])).toMatchObject({ action: "same", weight: 60 });
  });

  it("1 цільовий підхід: 6, потім 6 → розвантаження (min(2, 1) = 1)", () => {
    const plan = { targetSets: 1, repMin: 8, repMax: 12 };
    const rows = [...workout(BENCH, "10", 60, [6]), ...workout(BENCH, "12", 60, [6])];
    expect(everywhere(BENCH, plan, rows).workoutScreen).toMatchObject({ action: "deload", weight: 55 });
    const once = workout(BENCH, "10", 60, [7]);
    expect(everywhere(BENCH, plan, [...once, ...workout(BENCH, "12", 60, [7])]).workoutScreen.action).toBe("same");
  });

  it("підсумок 'Наступного разу': 7/6/6 у минулому + 6/6/8 сьогодні → 55 кг; 6/9/9 → 60 кг", () => {
    const summaryNext = (before: number[], today: number[]) => {
      const history = toExerciseHistory(groupSessionRows(workout(BENCH, "10", 60, before))).get(BENCH.id)!;
      return buildWorkoutSummary({
        startedAt: "2026-11-13T10:00:00.000Z",
        finishedAt: "2026-11-13T11:00:00.000Z",
        exercises: [{ exerciseId: BENCH.id, name: "Жим", ...PLAN_8_12, increment: 2.5, equipment: "barbell", ...history }],
        sets: today.map((reps) => ({ exerciseId: BENCH.id, weight: 60, reps, isCompleted: true })),
        previous: null,
      }).exercises[0].next;
    };
    expect(summaryNext([7, 6, 6], [6, 6, 8])).toMatchObject({ action: "deload", weight: 55 });
    expect(summaryNext([6, 9, 10], [6, 9, 9])).toMatchObject({ action: "same", weight: 60 });
  });
});

describe("історія для розвантаження: за датою, по exercise_id з усіх програм", () => {
  it("рядки в довільному порядку: сортування за датою, найновіше — перше", () => {
    // Найновіше (14) — успішне; два старші невдалі вже не "останні поспіль".
    const rows = [
      ...workout(BENCH, "14", 60, [10, 10, 10]),
      ...workout(BENCH, "10", 60, [7, 6, 6]),
      ...workout(BENCH, "12", 60, [6, 6, 8]),
    ].reverse();
    expect(everywhere(BENCH, PLAN_8_12, rows).workoutScreen).toMatchObject({ action: "same", weight: 60 });
    // А якщо найновіші два — невдалі, незалежно від порядку рядків → розвантаження.
    const failing = [
      ...workout(BENCH, "12", 60, [6, 6, 8]),
      ...workout(BENCH, "08", 60, [10, 10, 10]),
      ...workout(BENCH, "10", 60, [7, 6, 6]),
    ];
    expect(everywhere(BENCH, PLAN_8_12, failing).workoutScreen).toMatchObject({ action: "deload", weight: 55 });
  });

  it("невдалі тренування з різних програм (той самий exercise_id) рахуються поспіль", () => {
    // groupSessionRows групує лише за exercise_id — program_day тут ролі не грає.
    const rows = [...workout(BENCH, "10", 60, [7, 6, 6]), ...workout(BENCH, "12", 60, [6, 6, 8])];
    expect(everywhere(BENCH, PLAN_8_12, rows).chip).toMatchObject({ action: "deload", weightKg: 55 });
  });
});

describe("історія з іншої програми", () => {
  it("та сама вправа: 70×8,8,8 у програмі 5–8; поточна 8–12 → рахується за поточним діапазоном", () => {
    // Тренування з "Все тіло" (діапазон 5–8): exercise_id той самий — історія спільна.
    const rows = workout(BENCH, "05", 70, [8, 8, 8]);
    expect(everywhere(BENCH, { targetSets: 3, repMin: 5, repMax: 8 }, rows).workoutScreen.action).toBe("increase");

    // Тепер "НОВЕ ФУЛЛБАДІ" 3 × 8–12: 8 повторень — низ діапазону, вага та сама.
    const r = everywhere(BENCH, PLAN_8_12, rows);
    expect(r.workoutScreen).toMatchObject({ action: "same", weight: 70 });
    expect(r.chip).toMatchObject({ action: "same", weightKg: 70 });
    expect(initialSets(r.exercise)).toHaveLength(3);
  });

  it("кількість цільових підходів — з поточної програми (4 × 8–12: три підходи на 12 — ще не збільшення)", () => {
    const rows = workout(BENCH, "05", 60, [12, 12, 12]);
    const r = everywhere(BENCH, { targetSets: 4, repMin: 8, repMax: 12 }, rows);
    expect(r.workoutScreen).toMatchObject({ action: "same", weight: 60 });
    expect(initialSets(r.exercise)).toHaveLength(4);
  });
});

describe("власна вправа на блоці, крок 5 кг", () => {
  it("власна вправа отримує історію й крок з exercises.weight_increment: 40×12,12,12 → 45", () => {
    const rows = workout(MY_CABLE, "10", 40, [12, 12, 12]);
    const r = everywhere(MY_CABLE, PLAN_8_12, rows);
    expect(r.exercise).toMatchObject({ custom: true, increment: 5 });
    expect(r.workoutScreen).toMatchObject({ action: "increase", weight: 45 });
    expect(r.chip).toMatchObject({ action: "increase", weightKg: 45 });
    expect(r.dashboard).toMatchObject({ action: "increase", weight: 45 });
  });

  it("вага 42.5 в історії → рекомендація кратна 5", () => {
    const top = workout(MY_CABLE, "10", 42.5, [12, 12, 12]);
    expect(everywhere(MY_CABLE, PLAN_8_12, top).workoutScreen).toMatchObject({ action: "increase", weight: 45 });
    const mid = workout(MY_CABLE, "10", 42.5, [10, 10, 9]);
    expect(everywhere(MY_CABLE, PLAN_8_12, mid).workoutScreen).toMatchObject({ action: "same", weight: 40 });
    const fail = [...workout(MY_CABLE, "10", 42.5, [6, 6, 5]), ...workout(MY_CABLE, "12", 42.5, [6, 5, 5])];
    // 0.9 × 42.5 = 38.25 → до кроку 5 → 40 (кратне 5, нижче за 45).
    expect(everywhere(MY_CABLE, PLAN_8_12, fail).workoutScreen).toMatchObject({ action: "deload", weight: 40 });
  });
});

describe("вправа, додана під час тренування", () => {
  it("дефолт 3 × 8–12 і та сама історія по вправі", () => {
    const rows = workout(BENCH, "10", 60, [12, 12, 12]);
    const added = workoutExercise(BENCH, ADDED_EXERCISE_DEFAULTS, rows, "added");
    expect(added).toMatchObject({ source: "added", targetSets: 3, repMin: 8, repMax: 12 });
    expect(getSuggestion(added)).toMatchObject({ action: "increase", weight: 62.5 });
    expect(initialSets(added).map((s) => [s.weightKg, s.reps])).toEqual([[62.5, 8], [62.5, 8], [62.5, 8]]);
  });

  it("додана вправа без історії → 'Ще немає історії', порожня вага, рекордів немає", () => {
    const added = workoutExercise(BENCH, ADDED_EXERCISE_DEFAULTS, [], "added");
    expect(getSuggestion(added).action).toBe("none");
    expect(added.best).toBeNull();
    expect(initialSets(added)[0].weightKg).toBeNull();
    expect(explainSuggestion(progressionInput(added), getSuggestion(added), "uk")).toBe(
      "Ще немає історії — оберіть стартову вагу.",
    );
  });
});

describe("пропущені вправи й невиконані підходи", () => {
  it("останнє тренування, де вправу пропустили (лише невиконані підходи), не затирає історію", () => {
    const rows = [
      ...workout(BENCH, "10", 60, [12, 12, 12]),
      ...workout(BENCH, "13", 65, [12, 12, 12], { completed: [false, false, false] }),
    ];
    const r = everywhere(BENCH, PLAN_8_12, rows);
    expect(r.workoutScreen).toMatchObject({ action: "increase", weight: 62.5 });
    expect(r.chip).toMatchObject({ action: "increase", weightKg: 62.5 });
    expect(r.dashboard).toMatchObject({ action: "increase", weight: 62.5 });
    expect(previousSet(r.exercise, 1)).toMatchObject({ weight: 60, reps: 12 });
  });

  it("невиконаний важчий підхід не стає робочою вагою; невдача між пропуском рахується поспіль", () => {
    const mixed = [
      ...workout(BENCH, "10", 60, [7, 6, 6]),
      ...workout(BENCH, "12", 60, [12], { completed: [false] }), // пропуск
      ...workout(BENCH, "14", 60, [6, 6]), // два підходи ≤ 6 → невдале
      { ...workout(BENCH, "14", 80, [3], { completed: [false] })[0], workoutId: `w${seq - 1}`, setNumber: 3 },
    ];
    const r = everywhere(BENCH, PLAN_8_12, mixed);
    expect(r.workoutScreen).toMatchObject({ action: "deload", weight: 55 });
  });

  it("лише невиконані підходи за всю історію → none і жодного рекорду", () => {
    const rows = workout(BENCH, "10", 60, [12, 12], { completed: [false, false] });
    const ex = workoutExercise(BENCH, PLAN_8_12, rows);
    expect(getSuggestion(ex).action).toBe("none");
    expect(ex.best).toBeNull();
  });
});

describe("одиниці lb", () => {
  const lb = (value: number) => fromDisplayWeight(value, "lb");

  it("135 lb × 12,12,12 → 140 lb (крок 5 lb, а не 2.5 кг ≈ 5.5 lb)", () => {
    const rows = workout(BENCH, "10", lb(135), [12, 12, 12]);
    const r = everywhere(BENCH, PLAN_8_12, rows, "lb");
    expect(shown(r.workoutScreen.weight, "lb")).toBe(140);
    expect(shown(r.chip.weightKg, "lb")).toBe(140);
    expect(shown(r.dashboard!.weight, "lb")).toBe(140);
    expect(shown(initialSets(r.exercise, undefined, "lb")[0].weightKg, "lb")).toBe(140);
  });

  it("deload у lb лягає на сітку 5 lb: 135 → 120", () => {
    const rows = [...workout(BENCH, "10", lb(135), [7, 6, 6]), ...workout(BENCH, "12", lb(135), [7, 6, 6])];
    const r = everywhere(BENCH, PLAN_8_12, rows, "lb");
    expect(r.workoutScreen.action).toBe("deload");
    expect(shown(r.workoutScreen.weight, "lb")).toBe(120);
  });

  it("підсумок у lb: 'Наступного разу' +5 lb", () => {
    const summary = buildWorkoutSummary({
      startedAt: "2026-11-13T10:00:00.000Z",
      finishedAt: null,
      exercises: [{ exerciseId: BENCH.id, name: "Bench", ...PLAN_8_12, increment: 2.5, equipment: "barbell", history: [] }],
      sets: [12, 12, 12].map((reps) => ({ exerciseId: BENCH.id, weight: lb(135), reps, isCompleted: true })),
      previous: null,
      unit: "lb",
    });
    expect(shown(summary.exercises[0].next.weight, "lb")).toBe(140);
  });
});

describe("вправа з власною вагою", () => {
  it("віджимання без ваги: не '+2.5 кг', а та сама 0 — прогресія в повтореннях", () => {
    const rows = workout(PUSHUP, "10", 0, [15, 15, 15]);
    const plan = { targetSets: 3, repMin: 8, repMax: 15 };
    const r = everywhere(PUSHUP, plan, rows);
    expect(r.workoutScreen).toMatchObject({ action: "same", weight: 0, delta: 0 });
    expect(r.chip.action).toBe("bodyweight");
    expect(r.dashboard).toBeNull();
    expect(initialSets(r.exercise).map((s) => [s.weightKg, s.reps])).toEqual([[0, 15], [0, 15], [0, 15]]);
  });

  it("без історії → вага 0 у підходах", () => {
    const ex = workoutExercise(PUSHUP, PLAN_8_12, []);
    expect(getSuggestion(ex).action).toBe("none");
    expect(initialSets(ex)[0].weightKg).toBe(0);
  });

  it("з обтяженням (пояс 10 кг) — звичайна прогресія", () => {
    const rows = workout(PUSHUP, "10", 10, [12, 12, 12]);
    expect(everywhere(PUSHUP, PLAN_8_12, rows).workoutScreen).toMatchObject({ action: "increase", weight: 12.5 });
  });
});
