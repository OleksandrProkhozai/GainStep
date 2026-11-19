import { describe, expect, it } from "vitest";

import type { Equipment } from "../exercises/catalog";
import { nextChip, toRecentHistory } from "../programs/next";
import { groupSessionRows, type SessionRow } from "../workout/history";

const BENCH = "bench";
const OHP = "ohp";

/** Рядки одного тренування для вправи: rows(BENCH, "w1", "2026-11-10", 60, 12, 12, 12). */
const rows = (exerciseId: string, workoutId: string, day: string, weight: number, ...reps: number[]): SessionRow[] =>
  reps.map((r, i) => ({
    exerciseId,
    workoutId,
    startedAt: `${day}T10:00:00.000Z`,
    setNumber: i + 1,
    weight,
    reps: r,
    isCompleted: true,
  }));

const row = (
  exerciseId: string,
  overrides: Partial<{ targetSets: number; repMin: number; repMax: number; equipment: Equipment }> = {},
) => ({
  exerciseId,
  equipment: "barbell" as Equipment,
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  incrementKg: 2.5,
  ...overrides,
});

describe("groupSessionRows", () => {
  it("групує вправа → тренування (від найновішого) → підходи за номером", () => {
    const input = [
      ...rows(BENCH, "w1", "2026-11-10", 60, 10, 10),
      ...rows(OHP, "w2", "2026-11-12", 40, 8),
      ...rows(BENCH, "w2", "2026-11-12", 62.5, 8, 9).reverse(), // підходи навмисно в іншому порядку
    ];
    const grouped = groupSessionRows(input);
    expect([...grouped.keys()].sort()).toEqual([BENCH, OHP]);
    const bench = grouped.get(BENCH)!;
    expect(bench.map((s) => s.workoutId)).toEqual(["w2", "w1"]);
    expect(bench[0].sets.map((s) => s.reps)).toEqual([8, 9]);
    expect(groupSessionRows([]).size).toBe(0);
  });

  it("toRecentHistory лишає два останні тренування", () => {
    const grouped = groupSessionRows([
      ...rows(BENCH, "w1", "2026-11-01", 55, 12),
      ...rows(BENCH, "w2", "2026-11-05", 57.5, 12),
      ...rows(BENCH, "w3", "2026-11-09", 60, 12),
    ]);
    expect(toRecentHistory(grouped)[BENCH].map((s) => s.sets[0].weight)).toEqual([60, 57.5]);
  });
});

describe("nextChip", () => {
  const history = (...r: SessionRow[][]) => toRecentHistory(groupSessionRows(r.flat()));

  it("increase — усі підходи на верхній межі", () => {
    const h = history(rows(BENCH, "w1", "2026-11-10", 60, 10, 10, 10, 10));
    expect(nextChip(row(BENCH, { targetSets: 4, repMin: 6, repMax: 10 }), h)).toEqual({
      action: "increase",
      weightKg: 62.5,
      repMax: 10,
    });
  });

  it("same — діапазон ще не пройдено", () => {
    const h = history(rows(BENCH, "w1", "2026-11-10", 22, 12, 10, 9));
    expect(nextChip(row(BENCH), h)).toEqual({ action: "same", weightKg: 22, repMax: 12 });
  });

  it("deload — недобір двічі поспіль", () => {
    const h = history(rows(OHP, "w1", "2026-11-05", 40, 7, 6, 6), rows(OHP, "w2", "2026-11-10", 40, 7, 6, 5));
    expect(nextChip(row(OHP, { repMin: 8 }), h)).toEqual({ action: "deload", weightKg: 35, repMax: 12 });
  });

  it("none — немає історії", () => {
    expect(nextChip(row("new"), {})).toEqual({ action: "none", weightKg: null, repMax: 12 });
  });

  it("bodyweight без ваги в історії — нейтральний чип", () => {
    const h = history(rows("pullup", "w1", "2026-11-10", 0, 8, 8, 8));
    expect(nextChip(row("pullup", { equipment: "bodyweight" }), h)).toEqual({
      action: "bodyweight",
      weightKg: null,
      repMax: 12,
    });
    expect(nextChip(row("dip", { equipment: "bodyweight" }), {}).action).toBe("bodyweight");
  });

  it("bodyweight: вага лише в невиконаних підходах — нейтральний чип", () => {
    const h = history([
      ...rows("plank", "w1", "2026-11-10", 0, 30, 30),
      { ...rows("plank", "w1", "2026-11-10", 10, 30)[0], setNumber: 3, isCompleted: false },
    ]);
    expect(nextChip(row("plank", { equipment: "bodyweight" }), h).action).toBe("bodyweight");
  });

  it("bodyweight з додатковою вагою — звичайна прогресія", () => {
    const h = history(rows("pullup", "w1", "2026-11-10", 10, 12, 12, 12));
    expect(nextChip(row("pullup", { equipment: "bodyweight" }), h)).toMatchObject({ action: "increase", weightKg: 12.5 });
  });
});
