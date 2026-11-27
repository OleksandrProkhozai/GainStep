import { describe, expect, it } from "vitest";

import type { Session, SetResult } from "../progression";
import {
  buildWorkoutSummary,
  volumeChangePercent,
  workoutDurationMinutes,
  type SummaryExerciseInput,
  type SummaryInput,
  type SummarySetInput,
} from "../workout/summary";

// ───────────── Допоміжні фабрики ─────────────

const done = (weight: number, reps: number): SetResult => ({ weight, reps, isCompleted: true });

/** Тренування з однаковою вагою: session(60, 12, 12, 12). */
const session = (weight: number, ...reps: number[]): Session => ({
  sets: reps.map((r) => done(weight, r)),
});

/** Підходи поточного тренування для вправи. */
const sets = (exerciseId: string, weight: number, ...reps: number[]): SummarySetInput[] =>
  reps.map((r) => ({ exerciseId, weight, reps: r, isCompleted: true }));

/** Вправа програми: 8–12, 3 підходи, крок 2.5 кг. */
const exercise = (
  exerciseId: string,
  history: Session[] = [],
  overrides: Partial<SummaryExerciseInput> = {},
): SummaryExerciseInput => ({
  exerciseId,
  name: exerciseId,
  repMin: 8,
  repMax: 12,
  targetSets: 3,
  increment: 2.5,
  history,
  ...overrides,
});

const build = (overrides: Partial<SummaryInput>) =>
  buildWorkoutSummary({
    startedAt: "2026-11-18T10:00:00.000Z",
    finishedAt: "2026-11-18T10:52:00.000Z",
    exercises: [],
    sets: [],
    previous: null,
    ...overrides,
  });

// ───────────── Тести ─────────────

describe("buildWorkoutSummary — базові показники", () => {
  it("рахує тривалість, тоннаж, кількість підходів і ігнорує невиконані", () => {
    const s = build({
      exercises: [exercise("bench", [session(60, 12, 12, 12)])],
      sets: [
        ...sets("bench", 62.5, 12, 12, 12),
        { exerciseId: "bench", weight: 62.5, reps: 5, isCompleted: false },
      ],
    });
    expect(s.durationMinutes).toBe(52);
    expect(s.volumeKg).toBe(62.5 * 36);
    expect(s.setsDone).toBe(3);
    expect(s.exercises[0].sets).toHaveLength(3);
  });

  it("перше тренування: без рекордів і volumeChange = null", () => {
    const s = build({
      exercises: [exercise("bench"), exercise("ohp")],
      sets: [...sets("bench", 60, 10, 10, 10), ...sets("ohp", 40, 8, 8, 8)],
    });
    expect(s.prCount).toBe(0);
    expect(s.records).toEqual([]);
    expect(s.volumeChange).toBeNull();
    expect(s.exercises.every((e) => e.record === null && e.sets.every((x) => !x.isPR))).toBe(true);
  });

  it("volumeChange — у % відносно попереднього такого самого дня", () => {
    const s = build({
      exercises: [exercise("bench", [session(60, 10, 10, 10)])],
      sets: sets("bench", 60, 11, 11, 11),
      previous: { sets: [done(60, 10), done(60, 10), done(60, 10)] },
    });
    expect(s.volumeChange).toBeCloseTo(10);
    expect(volumeChangePercent(950, 1000)).toBeCloseTo(-5);
    expect(volumeChangePercent(100, 0)).toBeNull();
  });

  it("вправи без виконаних підходів не потрапляють у підсумок", () => {
    const s = build({
      exercises: [exercise("bench"), exercise("fly")],
      sets: sets("bench", 60, 10),
    });
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(["bench"]);
  });

  it("тривалість без finished_at — null", () => {
    expect(workoutDurationMinutes("2026-11-18T10:00:00Z", null)).toBeNull();
    expect(workoutDurationMinutes("2026-11-18T10:00:00Z", "2026-11-18T11:12:20Z")).toBe(72);
  });
});

describe("buildWorkoutSummary — рекорди", () => {
  it("рекорд порівнюється з історією ДО тренування, а не з самим собою", () => {
    const s = build({
      exercises: [exercise("bench", [session(60, 12, 12, 12)])],
      sets: sets("bench", 62.5, 12, 12, 12),
    });
    const bench = s.exercises[0];
    // лише перший підхід — рекорд; наступні такі самі вже не рахуються
    expect(bench.sets.map((x) => x.isPR)).toEqual([true, false, false]);
    expect(s.prCount).toBe(1);
    expect(bench.record).toMatchObject({ weight: 62.5, reps: 12, e1rm: 87.5 });
  });

  it("повтор попереднього результату — не рекорд", () => {
    const s = build({
      exercises: [exercise("bench", [session(60, 12, 12, 12)])],
      sets: sets("bench", 60, 12, 12, 12),
    });
    expect(s.prCount).toBe(0);
  });

  it("враховує переданий best за всю історію, а не лише останні тренування", () => {
    const s = build({
      exercises: [
        exercise("bench", [session(60, 12)], { best: { maxWeight: 80, bestE1RM: 90 } }),
      ],
      sets: sets("bench", 62.5, 12),
    });
    expect(s.prCount).toBe(0);
  });

  it("кілька рекордних вправ — список від найбільшого 1ПМ, найкращий підхід вправи", () => {
    const s = build({
      exercises: [
        exercise("raise", [session(10, 15)]),
        exercise("bench", [session(60, 12)]),
      ],
      sets: [...sets("raise", 11, 15), { exerciseId: "bench", weight: 62.5, reps: 10, isCompleted: true }, { exerciseId: "bench", weight: 62.5, reps: 12, isCompleted: true }],
    });
    expect(s.prCount).toBe(2);
    expect(s.records.map((r) => r.exerciseId)).toEqual(["bench", "raise"]);
    expect(s.records[0]).toMatchObject({ weight: 62.5, reps: 12 });
  });
});

describe("buildWorkoutSummary — Next time", () => {
  it("increase: усі підходи на верхній межі В ЦЬОМУ тренуванні", () => {
    const s = build({
      // минулого разу 10 повторень — без урахування поточного було б 'same'
      exercises: [exercise("bench", [session(62.5, 10, 10, 10)])],
      sets: sets("bench", 62.5, 12, 12, 12),
    });
    expect(s.exercises[0].next).toMatchObject({
      action: "increase",
      today: 62.5,
      weight: 65,
      delta: 2.5,
    });
  });

  it("same: діапазон ще не пройдено", () => {
    const s = build({
      exercises: [exercise("incline", [session(22.5, 12, 12, 12)], { increment: 2 })],
      sets: sets("incline", 22.5, 10, 10, 9),
    });
    expect(s.exercises[0].next).toMatchObject({ action: "same", today: 22.5, weight: 22.5, delta: 0 });
  });

  it("deload: невдале (≥ 2 підходи ≤ rep_min − 2) і це, і попереднє тренування", () => {
    const s = build({
      exercises: [exercise("ohp", [session(40, 8, 6, 6)])],
      sets: sets("ohp", 40, 7, 6, 6),
    });
    expect(s.exercises[0].next).toMatchObject({ action: "deload", today: 40, weight: 35, delta: -5 });
  });

  it("старе правило: один підхід < rep_min в обох тренуваннях — тепер same", () => {
    const s = build({
      exercises: [exercise("ohp", [session(40, 8, 7, 6)])],
      sets: sets("ohp", 40, 9, 7, 6),
    });
    expect(s.exercises[0].next).toMatchObject({ action: "same", today: 40, weight: 40 });
  });

  it("недобір лише в цьому тренуванні — ще не deload", () => {
    const s = build({
      exercises: [exercise("ohp", [session(40, 8, 8, 8)])],
      sets: sets("ohp", 40, 7, 6, 6),
    });
    expect(s.exercises[0].next.action).toBe("same");
  });

  it("робоча вага — максимальна, розминкові підходи не заважають increase", () => {
    const s = build({
      exercises: [exercise("bench")],
      sets: [...sets("bench", 40, 10), ...sets("bench", 60, 12, 12, 12)],
    });
    expect(s.exercises[0].next).toMatchObject({ action: "increase", today: 60, weight: 62.5 });
  });

  it("вправа поза програмою: 8–12, 3 підходи, крок вправи", () => {
    const s = build({
      exercises: [
        { exerciseId: "curl", name: "Curl", repMin: 8, repMax: 12, targetSets: 3, increment: 1, history: [] },
      ],
      sets: sets("curl", 12, 12, 12, 12),
    });
    const curl = s.exercises[0];
    expect(curl.record).toBeNull();
    expect(curl.next).toMatchObject({ action: "increase", today: 12, weight: 13, delta: 1 });
  });

  it("вправа поза програмою з двома підходами — increase не дає (target 3)", () => {
    const s = build({
      exercises: [exercise("curl", [], { increment: 1 })],
      sets: sets("curl", 12, 12, 12),
    });
    expect(s.exercises[0].next.action).toBe("same");
  });
});
