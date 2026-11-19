import { describe, expect, it } from "vitest";

import { buildSmartProgression } from "../dashboard/queries";
import type { SetResult } from "../progression";
import {
  countPRExercises,
  countPRExercisesInWorkouts,
  hasPR,
  type ExerciseSession,
} from "../workout/records";
import { suggestionReason } from "../workout/suggestion-text";

const done = (weight: number, reps: number): SetResult => ({ weight, reps, isCompleted: true });
const sets = (weight: number, ...reps: number[]) => reps.map((r) => done(weight, r));
const best = (maxWeight: number, bestE1RM: number) => ({ maxWeight, bestE1RM });

describe("countPRExercises", () => {
  it("рахує ВПРАВИ з рекордом, а не рекордні підходи", () => {
    // 62.5×12 і 65×10 — два рекордні підходи, але вправа одна
    const bench = { sets: [done(62.5, 12), done(65, 10)], best: best(60, 84) };
    expect(hasPR(bench)).toBe(true);
    expect(countPRExercises([bench])).toBe(1);
  });

  it("кілька вправ: рахуються лише ті, де є рекорд", () => {
    expect(
      countPRExercises([
        { sets: sets(62.5, 12), best: best(60, 84) }, // рекорд
        { sets: sets(40, 8), best: best(40, 52) }, // повтор — не рекорд
        { sets: sets(11, 15), best: best(10, 15) }, // рекорд
      ]),
    ).toBe(2);
  });

  it("без історії (best = null) і без виконаних підходів — 0", () => {
    expect(countPRExercises([{ sets: sets(100, 5), best: null }])).toBe(0);
    expect(
      countPRExercises([{ sets: [{ weight: 100, reps: 5, isCompleted: false }], best: best(60, 70) }]),
    ).toBe(0);
    expect(countPRExercises([])).toBe(0);
  });
});

describe("countPRExercisesInWorkouts", () => {
  const session = (workoutId: string, startedAt: string, weight: number, ...reps: number[]): ExerciseSession => ({
    workoutId,
    startedAt,
    sets: sets(weight, ...reps),
  });

  it("кожне тренування порівнюється лише з історією ДО нього", () => {
    const bench = [
      // порядок навмисно перемішано
      session("w3", "2026-11-19T10:00:00Z", 65, 10), // рекорд відносно w1, w2
      session("w1", "2026-11-10T10:00:00Z", 60, 12), // перше — не рекорд
      session("w2", "2026-11-17T10:00:00Z", 62.5, 12), // рекорд відносно w1
    ];
    const ohp = [
      session("w1", "2026-11-10T10:00:00Z", 40, 8),
      session("w2", "2026-11-17T10:00:00Z", 40, 8), // повтор — не рекорд
    ];
    // тиждень: w2, w3 → bench у w2 + bench у w3
    expect(countPRExercisesInWorkouts([bench, ohp], new Set(["w2", "w3"]))).toBe(2);
    // пізніше тренування не впливає на рекорд раннього
    expect(countPRExercisesInWorkouts([bench], new Set(["w2"]))).toBe(1);
  });

  it("тренування поза набором не рахуються; порожній тиждень — 0", () => {
    const bench = [session("w1", "2026-11-10T10:00:00Z", 60, 12), session("w2", "2026-11-17T10:00:00Z", 62.5, 12)];
    expect(countPRExercisesInWorkouts([bench], new Set(["w1"]))).toBe(0);
    expect(countPRExercisesInWorkouts([bench], new Set())).toBe(0);
  });
});

describe("suggestionReason", () => {
  const range = { repMin: 8, repMax: 12 };
  it("ключ = дія алгоритму, значення — межі діапазону (текст — у messages)", () => {
    for (const action of ["increase", "same", "deload", "none"] as const) {
      expect(suggestionReason({ action }, range)).toEqual({ key: action, values: range });
    }
  });
});

describe("buildSmartProgression", () => {
  const ex = (exerciseId: string) => ({
    exerciseId,
    name: exerciseId,
    repMin: 8,
    repMax: 12,
    targetSets: 3,
    increment: 2.5,
  });
  const s = (weight: number, ...reps: number[]): ExerciseSession => ({
    workoutId: `w-${weight}-${reps.join("")}`,
    startedAt: "2026-11-17T10:00:00Z",
    sets: sets(weight, ...reps),
  });

  it("рекомендації в порядку дня, вправи без історії пропускаються", () => {
    const result = buildSmartProgression(
      [ex("bench"), ex("new"), ex("ohp"), ex("raise")],
      new Map([
        ["bench", [s(60, 12, 12, 12)]],
        ["ohp", [s(40, 7, 6, 6), s(40, 7, 7, 6)]],
        ["raise", [s(10, 12, 10, 10)]],
      ]),
    );
    expect(result.map((r) => [r.exerciseId, r.suggestion.action, r.suggestion.weight])).toEqual([
      ["bench", "increase", 62.5],
      ["ohp", "deload", 35],
      ["raise", "same", 10],
    ]);
  });

  it("немає історії ні для однієї вправи — порожній список", () => {
    expect(buildSmartProgression([ex("a"), ex("b")], new Map())).toEqual([]);
  });
});
