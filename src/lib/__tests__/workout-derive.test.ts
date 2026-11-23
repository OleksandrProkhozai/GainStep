import { describe, expect, it } from "vitest";

import type { Session } from "../progression";
import {
  appendSet,
  applyWeight,
  bestE1RMToday,
  buildSets,
  clampReps,
  clampWeightKg,
  initialSets,
  nextExerciseWithPending,
  nextPendingSet,
  planRest,
  prIds,
  removeSet,
  workoutStats,
} from "../workout/derive";
import type { WorkoutExercise, WorkoutSet } from "../workout/types";

const session = (weight: number, ...reps: number[]): Session => ({
  sets: reps.map((r) => ({ weight, reps: r, isCompleted: true })),
});

const exercise = (over: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  exerciseId: "bench",
  name: "Bench Press",
  muscleGroup: "chest",
  equipment: "barbell",
  increment: 2.5,
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  restSeconds: 90,
  history: [],
  best: null,
  ...over,
});

let counter = 0;
const id = () => `id-${++counter}`;

const set = (over: Partial<WorkoutSet>): WorkoutSet => ({
  clientId: id(),
  exerciseId: "bench",
  setNumber: 1,
  weightKg: 60,
  reps: 10,
  isCompleted: false,
  completedAt: null,
  tracked: false,
  ...over,
});

describe("initialSets", () => {
  it("increase: вага з підказки, повторення = rep_min, кількість = target_sets", () => {
    const sets = initialSets(exercise({ history: [session(60, 12, 12, 12)] }), id);
    expect(sets).toHaveLength(3);
    expect(sets.map((s) => [s.setNumber, s.weightKg, s.reps])).toEqual([
      [1, 62.5, 8],
      [2, 62.5, 8],
      [3, 62.5, 8],
    ]);
  });

  it("same: повторення відповідного підходу минулого разу, інакше rep_max", () => {
    const sets = initialSets(exercise({ targetSets: 4, history: [session(62.5, 10, 9, 8)] }), id);
    expect(sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [62.5, 10],
      [62.5, 9],
      [62.5, 8],
      [62.5, 12],
    ]);
  });

  it("deload: повторення = rep_min", () => {
    const sets = initialSets(
      exercise({ history: [session(62.5, 9, 7, 6), session(62.5, 10, 8, 7)] }),
      id,
    );
    expect(sets[0]).toMatchObject({ weightKg: 57.5, reps: 8 });
  });

  it("none без історії: вага порожня, для власної ваги — 0", () => {
    expect(initialSets(exercise(), id)[0]).toMatchObject({ weightKg: null, reps: 12 });
    expect(initialSets(exercise({ equipment: "bodyweight" }), id)[0].weightKg).toBe(0);
  });

  it("none з невиконаними підходами минулого разу: вага першого підходу", () => {
    const history: Session[] = [{ sets: [{ weight: 40, reps: 10, isCompleted: false }] }];
    expect(initialSets(exercise({ history }), id)[0].weightKg).toBe(40);
  });
});

describe("buildSets", () => {
  it("збережені в базі підходи мають пріоритет над початковими", () => {
    const ex = [exercise(), exercise({ exerciseId: "ohp" })];
    const sets = buildSets(
      ex,
      [{ exerciseId: "ohp", setNumber: 1, weightKg: 40, reps: 8, isCompleted: true, completedAt: null }],
      id,
    );
    expect(sets.filter((s) => s.exerciseId === "bench")).toHaveLength(3);
    expect(sets.filter((s) => s.exerciseId === "ohp")).toEqual([
      expect.objectContaining({ weightKg: 40, reps: 8, isCompleted: true, tracked: true }),
    ]);
  });
});

describe("applyWeight", () => {
  it("переносить вагу на наступні невиконані підходи цієї вправи", () => {
    const a = set({ setNumber: 1 });
    const b = set({ setNumber: 2, isCompleted: true });
    const c = set({ setNumber: 3 });
    const other = set({ exerciseId: "ohp", setNumber: 2 });
    const result = applyWeight([a, b, c, other], a.clientId, 65);
    expect(result.map((s) => s.weightKg)).toEqual([65, 60, 65, 60]);
  });

  it("не змінює попередні підходи", () => {
    const a = set({ setNumber: 1 });
    const b = set({ setNumber: 2 });
    expect(applyWeight([a, b], b.clientId, 70).map((s) => s.weightKg)).toEqual([60, 70]);
  });
});

describe("removeSet / appendSet", () => {
  it("видалення перенумеровує підходи", () => {
    const sets = [1, 2, 3].map((n) => set({ setNumber: n }));
    const result = removeSet(sets, sets[0].clientId);
    expect(result.map((s) => s.setNumber)).toEqual([1, 2]);
  });

  it("новий підхід копіює значення останнього", () => {
    const sets = [set({ setNumber: 1, weightKg: 62.5, reps: 11, isCompleted: true })];
    const result = appendSet(sets, exercise(), id);
    expect(result[1]).toMatchObject({ setNumber: 2, weightKg: 62.5, reps: 11, isCompleted: false });
  });
});

describe("рекорди й статистика", () => {
  const ex = exercise({ best: { maxWeight: 60, bestE1RM: 84 } });

  it("prIds: другий такий самий підхід уже не рекорд", () => {
    const a = set({ setNumber: 1, weightKg: 62.5, reps: 12, isCompleted: true });
    const b = set({ setNumber: 2, weightKg: 62.5, reps: 12, isCompleted: true });
    expect([...prIds(ex, [a, b])]).toEqual([a.clientId]);
  });

  it("workoutStats: тоннаж і підходи лише виконаних", () => {
    const sets = [
      set({ weightKg: 62.5, reps: 12, isCompleted: true }),
      set({ setNumber: 2, weightKg: 62.5, reps: 12 }),
    ];
    expect(workoutStats([ex], sets)).toEqual({ volumeKg: 750, setsDone: 1, prs: 1 });
  });

  it("bestE1RMToday", () => {
    expect(bestE1RMToday([set({ weightKg: 62.5, reps: 12, isCompleted: true })])).toBe(87.5);
    expect(bestE1RMToday([set({ weightKg: 62.5, reps: 12 })])).toBe(0);
  });
});

describe("nextPendingSet", () => {
  it("шукає в поточній, потім у наступних вправах", () => {
    const ex = [exercise(), exercise({ exerciseId: "ohp" })];
    const sets = [
      set({ isCompleted: true }),
      set({ exerciseId: "ohp", setNumber: 1, weightKg: 20 }),
    ];
    expect(nextPendingSet(ex, sets, 0)?.set.weightKg).toBe(20);
    expect(nextPendingSet(ex, [set({ isCompleted: true })], 0)).toBeNull();
  });
});

describe("межі", () => {
  it("вага 0–500 кг, повторення 0–100", () => {
    expect(clampWeightKg(-5)).toBe(0);
    expect(clampWeightKg(600)).toBe(500);
    expect(clampReps(150)).toBe(100);
    expect(clampReps(7.6)).toBe(8);
  });
});

describe("planRest — перехід лише коли всі підходи вправи виконані", () => {
  const settings = { minRestSeconds: 0, transitionRestEnabled: true };
  const bench = exercise({ exerciseId: "bench", isCompound: true, restSeconds: 120 });
  const raise = exercise({ exerciseId: "raise", isCompound: false, restSeconds: 60 });
  const curl = exercise({ exerciseId: "curl", isCompound: false, restSeconds: 60 });
  const exercises = [bench, raise, curl];
  const sets = (spec: Record<string, boolean[]>) =>
    Object.entries(spec).flatMap(([exerciseId, done]) =>
      done.map((isCompleted, i) => set({ exerciseId, setNumber: i + 1, isCompleted })),
    );

  it("не останній підхід → звичайний відпочинок між підходами", () => {
    expect(planRest(bench, exercises, sets({ bench: [true, false, false], raise: [false], curl: [false] }), settings)).toEqual({
      kind: "set",
      seconds: 120,
      nextExerciseId: null,
    });
  });

  it("останній підхід базової вправи → 5:00 до наступної невиконаної", () => {
    expect(planRest(bench, exercises, sets({ bench: [true, true, true], raise: [false], curl: [false] }), settings)).toEqual({
      kind: "transition",
      seconds: 300,
      nextExerciseId: "raise",
    });
  });

  it("підходи не по порядку: перехід лише коли виконані ВСІ", () => {
    // повернулись до жиму: відмітили 1-й, але 3-й ще ні → звичайний
    expect(planRest(bench, exercises, sets({ bench: [true, false, true], raise: [true], curl: [false] }), settings).kind).toBe("set");
    // тепер усі → перехід; наступна — перша невиконана (raise виконана, тож curl)
    expect(planRest(bench, exercises, sets({ bench: [true, true, true], raise: [true], curl: [false] }), settings)).toMatchObject({
      kind: "transition",
      nextExerciseId: "curl",
    });
  });

  it("пропущена раніше вправа: наступна — з початку списку", () => {
    expect(planRest(curl, exercises, sets({ bench: [false], raise: [true], curl: [true] }), settings)).toMatchObject({
      kind: "transition",
      seconds: 180,
      nextExerciseId: "bench",
    });
  });

  it("остання вправа тренування або вимкнено → звичайний відпочинок", () => {
    const allDone = sets({ bench: [true], raise: [true], curl: [true] });
    expect(planRest(curl, exercises, allDone, settings)).toEqual({ kind: "set", seconds: 60, nextExerciseId: null });
    const pending = sets({ bench: [true], raise: [false], curl: [false] });
    expect(planRest(bench, exercises, pending, { ...settings, transitionRestEnabled: false }).kind).toBe("set");
  });

  it("власне значення і мінімум з налаштувань", () => {
    const custom = exercise({ exerciseId: "bench", isCompound: true, transitionRestSeconds: 240 });
    const pending = sets({ bench: [true], raise: [false] });
    expect(planRest(custom, [custom, raise], pending, settings).seconds).toBe(240);
    expect(planRest(custom, [custom, raise], pending, { ...settings, minRestSeconds: 270 }).seconds).toBe(270);
  });

  it("nextExerciseWithPending", () => {
    const s = sets({ bench: [true], raise: [false], curl: [false] });
    expect(nextExerciseWithPending(exercises, s, "bench")?.exerciseId).toBe("raise");
    expect(nextExerciseWithPending(exercises, sets({ bench: [true], raise: [true], curl: [true] }), "curl")).toBeNull();
  });
});
