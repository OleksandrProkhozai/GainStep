import { describe, expect, it, vi } from "vitest";

import {
  applyChangesToDay,
  canRemoveExercise,
  exercisePlanSchema,
  hasPlanChanges,
  indexAfterRemoval,
  indexAfterRestore,
  insertExercises,
  parsePlan,
  planChanges,
  planFromDay,
  planFromExercises,
  progressionParams,
  removeExercise,
  restoreExercise,
  type PlanItem,
  type SaveDayExercise,
} from "../workout/plan";
import { createWorkoutStore, PLAN_KEY } from "../workout/store";
import type { WorkoutExercise } from "../workout/types";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ex = (n: number, extra: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  exerciseId: id(n),
  name: `Ex ${n}`,
  muscleGroup: "chest",
  equipment: "barbell",
  increment: 2.5,
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  restSeconds: 90,
  history: [],
  best: null,
  ...extra,
});
const ids = (list: { exerciseId: string }[]) => list.map((e) => e.exerciseId);
const item = (n: number, source: PlanItem["source"] = "program"): PlanItem => ({
  exercise_id: id(n),
  target_sets: 3,
  rep_min: 8,
  rep_max: 12,
  rest_seconds: 90,
  source,
});

describe("insertExercises — додати вправу", () => {
  const list = [ex(1), ex(2), ex(3)];

  it("за замовчуванням — одразу після поточної, поточна не змінюється", () => {
    const r = insertExercises(list, [ex(9)], 0, "afterCurrent");
    expect(ids(r.list)).toEqual([id(1), id(9), id(2), id(3)]);
    expect(r.currentIndex).toBe(0);
  });

  it("кілька вправ — після поточної у вибраному порядку", () => {
    const r = insertExercises(list, [ex(8), ex(9)], 1, "afterCurrent");
    expect(ids(r.list)).toEqual([id(1), id(2), id(8), id(9), id(3)]);
    expect(r.currentIndex).toBe(1);
  });

  it("у кінець", () => {
    const r = insertExercises(list, [ex(9)], 0, "end");
    expect(ids(r.list)).toEqual([id(1), id(2), id(3), id(9)]);
  });

  it("поточна — остання: після поточної = у кінець", () => {
    const r = insertExercises(list, [ex(9)], 2, "afterCurrent");
    expect(ids(r.list)).toEqual([id(1), id(2), id(3), id(9)]);
  });

  it("вправи, що вже є (і дублікати у виборі), пропускаються", () => {
    const r = insertExercises(list, [ex(2), ex(9), ex(9)], 0, "end");
    expect(ids(r.added)).toEqual([id(9)]);
    expect(r.list).toHaveLength(4);
  });

  it("нічого нового — список той самий", () => {
    const r = insertExercises(list, [ex(1)], 0, "afterCurrent");
    expect(r.added).toEqual([]);
    expect(ids(r.list)).toEqual(ids(list));
  });
});

describe("removeExercise — прибрати вправу", () => {
  it("прибирає вправу й повертає її місце", () => {
    const r = removeExercise([ex(1), ex(2), ex(3)], id(2));
    expect(r && ids(r.list)).toEqual([id(1), id(3)]);
    expect(r?.removedIndex).toBe(1);
    expect(r?.removed.exerciseId).toBe(id(2));
  });

  it("не можна прибрати останню вправу тренування", () => {
    expect(removeExercise([ex(1)], id(1))).toBeNull();
    expect(canRemoveExercise([ex(1)], id(1))).toBe(false);
  });

  it("невідома вправа — null", () => {
    expect(removeExercise([ex(1), ex(2)], id(7))).toBeNull();
    expect(canRemoveExercise([ex(1), ex(2)], id(7))).toBe(false);
  });
});

describe("indexAfterRemoval — поточна вправа після прибирання", () => {
  it("прибрали поточну → фокус на наступну (той самий індекс)", () => {
    expect(indexAfterRemoval(1, 1, 2)).toBe(1);
  });

  it("прибрали поточну, що була останньою → попередня", () => {
    expect(indexAfterRemoval(2, 2, 2)).toBe(1);
  });

  it("прибрали вправу перед поточною → індекс зсувається назад", () => {
    expect(indexAfterRemoval(2, 0, 3)).toBe(1);
  });

  it("прибрали вправу після поточної → без змін", () => {
    expect(indexAfterRemoval(0, 2, 3)).toBe(0);
  });
});

describe("restoreExercise — undo", () => {
  it("повертає вправу на колишнє місце", () => {
    const list = [ex(1), ex(2), ex(3)];
    const r = removeExercise(list, id(2))!;
    expect(ids(restoreExercise(r.list, r.removed, r.removedIndex))).toEqual(ids(list));
  });

  it("список скоротився — у кінець; повторне undo нічого не дублює", () => {
    const restored = restoreExercise([ex(1)], ex(5), 3);
    expect(ids(restored)).toEqual([id(1), id(5)]);
    expect(ids(restoreExercise(restored, ex(5), 0))).toEqual([id(1), id(5)]);
  });

  it("поточна зсувається, якщо вправу повернули перед нею", () => {
    expect(indexAfterRestore(1, 0)).toBe(2);
    expect(indexAfterRestore(1, 1)).toBe(2);
    expect(indexAfterRestore(1, 2)).toBe(1);
  });
});

describe("склад ↔ база", () => {
  it("planFromDay — порядок дня, source 'program', без дублікатів", () => {
    const plan = planFromDay([
      { exercise_id: id(1), target_sets: 4, rep_min: 6, rep_max: 8, rest_seconds: 120 },
      { exercise_id: id(2), target_sets: 3, rep_min: 10, rep_max: 12, rest_seconds: 60 },
      { exercise_id: id(1), target_sets: 3, rep_min: 8, rep_max: 12, rest_seconds: 90 },
    ]);
    expect(plan.map((p) => p.exercise_id)).toEqual([id(1), id(2)]);
    expect(plan[0]).toMatchObject({ target_sets: 4, rep_min: 6, rep_max: 8, rest_seconds: 120, source: "program" });
  });

  it("planFromExercises — старі стани без source → 'program'", () => {
    const plan = planFromExercises([ex(1), ex(2, { source: "added" })]);
    expect(plan.map((p) => p.source)).toEqual(["program", "added"]);
    expect(exercisePlanSchema.safeParse(plan).success).toBe(true);
  });

  it("parsePlan — null / пошкоджений / порожній / з дублікатами → null", () => {
    expect(parsePlan(null)).toBeNull();
    expect(parsePlan([{ exercise_id: "x" }])).toBeNull();
    expect(parsePlan([])).toBeNull();
    expect(parsePlan([item(1), item(1)])).toBeNull();
    expect(parsePlan([item(1), item(2, "added")])).toHaveLength(2);
  });

  it("progressionParams — склад → день → значення доданої вправи", () => {
    const params = progressionParams(
      [{ ...item(1, "added"), target_sets: 5, rep_min: 5, rep_max: 5 }],
      [{ exercise_id: id(2), target_sets: 4, rep_min: 6, rep_max: 10 }],
    );
    expect(params(id(1))).toEqual({ targetSets: 5, repMin: 5, repMax: 5 });
    expect(params(id(2))).toEqual({ targetSets: 4, repMin: 6, repMax: 10 });
    expect(params(id(3))).toEqual({ targetSets: 3, repMin: 8, repMax: 12 });
  });
});

describe("planChanges — картка змін на підсумку", () => {
  const day = [id(1), id(2), id(3)];

  it("додані (у порядку тренування) і прибрані (у порядку дня)", () => {
    const changes = planChanges([item(1), item(9, "added"), item(3), item(8, "added")], day);
    expect(changes.added.map((p) => p.exercise_id)).toEqual([id(9), id(8)]);
    expect(changes.removed).toEqual([id(2)]);
    expect(hasPlanChanges(changes)).toBe(true);
  });

  it("склад як у дні — змін немає", () => {
    expect(hasPlanChanges(planChanges([item(1), item(2), item(3)], day))).toBe(false);
  });

  it("порядок у складі інший — це не зміна складу", () => {
    expect(hasPlanChanges(planChanges([item(3), item(1), item(2)], day))).toBe(false);
  });

  it("день уже оновили (додана вправа тепер у дні) — змін немає", () => {
    expect(hasPlanChanges(planChanges([item(1), item(2), item(3), item(9, "added")], [...day, id(9)]))).toBe(false);
  });

  it("старе тренування без складу — змін немає", () => {
    expect(hasPlanChanges(planChanges(null, day))).toBe(false);
  });
});

describe("applyChangesToDay — оновити день у програмі", () => {
  const row = (n: number): SaveDayExercise => ({
    id: id(100 + n),
    exercise_id: id(n),
    target_sets: 4,
    rep_min: 6,
    rep_max: 8,
    rest_seconds: 120,
    transition_rest_seconds: 240,
  });

  it("прибрані видаляються, додані — у кінець новими рядками", () => {
    const changes = planChanges([item(1), item(3), item(9, "added")], [id(1), id(2), id(3)]);
    const next = applyChangesToDay([row(1), row(2), row(3)], changes);
    expect(next.map((e) => e.exercise_id)).toEqual([id(1), id(3), id(9)]);
    expect(next[0]).toEqual(row(1)); // наявні рядки — без змін
    expect(next[2]).toEqual({
      id: null,
      exercise_id: id(9),
      target_sets: 3,
      rep_min: 8,
      rep_max: 12,
      rest_seconds: 90,
      transition_rest_seconds: null,
    });
  });
});

describe("стор: додати / прибрати / повернути", () => {
  // Стор без localStorage (node) — persist лише попереджає.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const init = (exercises: WorkoutExercise[]) =>
    createWorkoutStore({
      workoutId: id(500),
      name: "Push",
      programName: null,
      startedAt: new Date(0).toISOString(),
      notes: "",
      exercises,
      savedSets: [],
      planStored: true,
    });

  it("додана вправа отримує підходи 3 × і склад іде в чергу синхронізації", () => {
    const store = init([ex(1), ex(2)]);
    store.getState().addExercises([ex(9, { source: "added" })], "afterCurrent");
    const s = store.getState();
    expect(ids(s.exercises)).toEqual([id(1), id(9), id(2)]);
    expect(s.sets.filter((x) => x.exerciseId === id(9))).toHaveLength(3);
    expect(s.pending[PLAN_KEY]).toBe(1);
  });

  it("прибрали поточну → фокус на наступну, таймер відпочинку працює далі", () => {
    const store = init([ex(1), ex(2), ex(3)]);
    store.getState().goTo(1);
    store.getState().startRest(90, 1_000, "transition", id(2));
    store.getState().removeExercise(id(2));
    const s = store.getState();
    expect(s.exercises[s.currentIndex].exerciseId).toBe(id(3));
    expect(s.rest.endsAt).toBe(91_000);
    // "Далі: …" переходить на наступну невиконану вправу
    expect(s.rest.nextExerciseId).toBe(id(3));
  });

  it("виконані підходи прибраної вправи — у черзі (рядки видалить синхронізація); undo повертає все", () => {
    const store = init([ex(1), ex(2)]);
    const first = store.getState().sets.find((x) => x.exerciseId === id(2))!;
    store.getState().setWeight(first.clientId, 60);
    expect(store.getState().complete(first.clientId, 5_000)).not.toBeNull();
    const removed = store.getState().removeExercise(id(2))!;
    expect(store.getState().sets.some((x) => x.exerciseId === id(2))).toBe(false);
    expect(store.getState().pending[id(2)]).toBeGreaterThan(0);

    store.getState().restoreExercise(removed);
    const s = store.getState();
    expect(ids(s.exercises)).toEqual([id(1), id(2)]);
    expect(s.sets.filter((x) => x.exerciseId === id(2))).toHaveLength(3);
    expect(s.sets.find((x) => x.clientId === first.clientId)?.isCompleted).toBe(true);
  });

  it("останню вправу прибрати не можна", () => {
    const store = init([ex(1)]);
    expect(store.getState().removeExercise(id(1))).toBeNull();
    expect(store.getState().exercises).toHaveLength(1);
  });
});
