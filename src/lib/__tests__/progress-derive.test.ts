import { describe, expect, it } from "vitest";

import {
  buildExerciseHistories,
  percentChange,
  personalRecords,
  summarizeRange,
  weeklyVolume,
  type ProgressSet,
} from "../progress/derive";

const bench = (workoutId: string, startedAt: string, weight: number, reps: number): ProgressSet => ({
  exerciseId: "bench",
  exerciseName: "Bench Press",
  workoutId,
  startedAt,
  weight,
  reps,
});

const squat = (workoutId: string, startedAt: string, weight: number, reps: number): ProgressSet => ({
  exerciseId: "squat",
  exerciseName: "Squat",
  workoutId,
  startedAt,
  weight,
  reps,
});

describe("buildExerciseHistories", () => {
  const sets = [
    bench("w1", "2026-09-01T09:00:00Z", 40, 10), // розминка
    bench("w1", "2026-09-01T09:00:00Z", 55, 12),
    bench("w1", "2026-09-01T09:00:00Z", 55, 10),
    bench("w2", "2026-09-08T09:00:00Z", 57.5, 9),
    bench("w3", "2026-09-15T09:00:00Z", 52.5, 12),
    squat("w2", "2026-09-08T09:00:00Z", 100, 5),
  ];
  const histories = buildExerciseHistories(sets);
  const benchHistory = histories.find((h) => h.id === "bench")!;

  it("групує підходи в тренування від старих до нових", () => {
    expect(benchHistory.sessions.map((s) => s.workingWeight)).toEqual([55, 57.5, 52.5]);
  });

  it("найкращий підхід — за 1ПМ, робоча вага — максимальна", () => {
    expect(benchHistory.sessions[0].bestSet).toEqual({ weight: 55, reps: 12 });
    expect(benchHistory.sessions[0].e1rm).toBeCloseTo(77, 6);
  });

  it("позначає збільшення і зниження ваги", () => {
    expect(benchHistory.sessions.map((s) => s.change)).toEqual([null, "increase", "deload"]);
  });

  it("найчастіші вправи — першими", () => {
    expect(histories.map((h) => h.id)).toEqual(["bench", "squat"]);
  });

  it("пропускає підходи без ваги або повторень", () => {
    const result = buildExerciseHistories([
      { ...bench("w1", "2026-09-01T09:00:00Z", 0, 10), exerciseId: "pullup", exerciseName: "Pull-up" },
    ]);
    expect(result).toEqual([]);
  });
});

describe("summarizeRange", () => {
  const sessions = buildExerciseHistories([
    bench("w1", "2026-08-01T09:00:00Z", 50, 12),
    bench("w2", "2026-09-01T09:00:00Z", 52.5, 12),
    bench("w3", "2026-10-01T09:00:00Z", 60, 8),
    bench("w4", "2026-11-01T09:00:00Z", 62.5, 12),
  ])[0].sessions;

  it("рахує зміну від першого тренування періоду", () => {
    const summary = summarizeRange(sessions, Date.parse("2026-08-15T00:00:00Z"));
    expect(summary.sessions).toHaveLength(3);
    expect(summary.workingWeight).toEqual({ value: 62.5, delta: 10 });
    expect(summary.e1rm?.value).toBe(87.5);
    expect(summary.e1rm?.delta).toBe(14); // 87.5 − 73.5 (52.5 × 12)
    expect(summary.bestSet).toEqual({ weight: 62.5, reps: 12, e1rm: 87.5 });
  });

  it("null — уся історія", () => {
    expect(summarizeRange(sessions, null).sessions).toHaveLength(4);
  });

  it("одне тренування — без зміни", () => {
    const summary = summarizeRange(sessions, Date.parse("2026-10-15T00:00:00Z"));
    expect(summary.workingWeight).toEqual({ value: 62.5, delta: null });
  });

  it("порожній період", () => {
    const summary = summarizeRange(sessions, Date.parse("2026-12-01T00:00:00Z"));
    expect(summary).toEqual({ sessions: [], workingWeight: null, e1rm: null, bestSet: null });
  });
});

describe("personalRecords", () => {
  it("найкращий 1ПМ кожної вправи, найсвіжіші — першими", () => {
    const records = personalRecords(
      buildExerciseHistories([
        bench("w1", "2026-11-01T09:00:00Z", 60, 10),
        bench("w2", "2026-11-17T09:00:00Z", 62.5, 12),
        bench("w3", "2026-11-18T09:00:00Z", 60, 8),
        squat("w4", "2026-11-14T09:00:00Z", 100, 5),
      ]),
    );
    expect(records.map((r) => [r.name, r.weight, r.reps])).toEqual([
      ["Bench Press", 62.5, 12],
      ["Squat", 100, 5],
    ]);
    expect(records[0].t).toBe(Date.parse("2026-11-17T09:00:00Z"));
  });

  it("за рівного 1ПМ рекорд — перший, а не повторений", () => {
    const records = personalRecords(
      buildExerciseHistories([
        bench("w1", "2026-11-01T09:00:00Z", 60, 10),
        bench("w2", "2026-11-08T09:00:00Z", 60, 10),
      ]),
    );
    expect(records[0].t).toBe(Date.parse("2026-11-01T09:00:00Z"));
  });
});

describe("weeklyVolume", () => {
  // 2026-11-17 — вівторок; поточний тиждень починається 16 листопада.
  const now = new Date("2026-11-17T12:00:00Z");

  it("повертає задану кількість тижнів, від старих до поточного", () => {
    const weeks = weeklyVolume([], now, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks[7].week).toBe("2026-11-16");
    expect(weeks[0].week).toBe("2026-09-28");
  });

  it("сумує тоннаж у свій тиждень і відкидає старші", () => {
    const weeks = weeklyVolume(
      [
        { startedAt: "2026-11-16T08:00:00Z", weight: 100, reps: 5 },
        { startedAt: "2026-11-17T08:00:00Z", weight: 50, reps: 10 },
        { startedAt: "2026-11-15T08:00:00Z", weight: 60, reps: 10 },
        { startedAt: "2026-01-01T08:00:00Z", weight: 999, reps: 10 },
      ],
      now,
      2,
    );
    expect(weeks).toEqual([
      { week: "2026-11-09", volumeKg: 600 },
      { week: "2026-11-16", volumeKg: 1000 },
    ]);
  });
});

describe("percentChange", () => {
  it("рахує зміну у відсотках", () => {
    expect(percentChange(14_200, 12_680)).toBe(12);
    expect(percentChange(90, 100)).toBe(-10);
  });

  it("null, якщо попереднього значення немає", () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});
