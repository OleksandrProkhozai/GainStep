import { describe, expect, it } from "vitest";

import { toTimeKey, wallClockDate, zonedTimeToISO } from "../dates";
import {
  analyzeExerciseSessions,
  assembleWorkout,
  filterWorkouts,
  groupByWeek,
  monthSummary,
  recentRecords,
  workoutStats,
  type AnalyzedSession,
  type HistoryWorkout,
  type RawHistoryWorkout,
} from "../history/derive";
import { editWorkoutSchema, parseEditDraft, type EditDraft } from "../history/edit-schema";
import { buildExportRows, columnWidths, exportFileName, type ExportLabels } from "../history/export";
import { historyRange, monthBounds, parseMonthParam, queryBounds, shiftMonth } from "../history/month";
import { historyHref, parseHistoryQuery } from "../history/url";
import type { SetResult } from "../progression";
import type { ExerciseSession } from "../workout/records";

// ───────────── Фабрики ─────────────

const done = (weight: number, reps: number): SetResult => ({ weight, reps, isCompleted: true });
const skipped = (weight: number, reps: number): SetResult => ({ weight, reps, isCompleted: false });

const session = (workoutId: string, startedAt: string, ...sets: SetResult[]): ExerciseSession => ({
  workoutId,
  startedAt,
  sets,
});

const meta = (exerciseId: string, name = exerciseId, nameUk: string | null = null) => ({
  exerciseId,
  name,
  nameUk,
  muscleGroup: "chest",
  imagePath: null,
  custom: false,
});

/** Мінімальне тренування для групування / фільтрів / підсумку. */
const workout = (over: Partial<HistoryWorkout> & { id: string; dayKey: string }): HistoryWorkout => ({
  name: "Push",
  programId: null,
  programDayId: null,
  startedAt: `${over.dayKey}T15:00:00Z`,
  finishedAt: null,
  notes: "",
  exercises: [],
  stats: { durationMinutes: 60, volumeKg: 1000, setsDone: 10 },
  prCount: 0,
  deload: false,
  ...over,
});

// ───────────── workoutStats ─────────────

describe("workoutStats", () => {
  it("рахує тривалість, тоннаж і підходи лише з виконаних підходів", () => {
    const stats = workoutStats({
      startedAt: "2026-11-19T16:10:00Z",
      finishedAt: "2026-11-19T17:15:00Z",
      sets: [done(80, 10), done(80, 10), skipped(80, 9), done(12, 15)],
    });
    expect(stats).toEqual({ durationMinutes: 65, volumeKg: 80 * 10 * 2 + 12 * 15, setsDone: 3 });
  });

  it("без finished_at — тривалість null", () => {
    expect(workoutStats({ startedAt: "2026-11-19T16:10:00Z", finishedAt: null, sets: [] })).toEqual({
      durationMinutes: null,
      volumeKg: 0,
      setsDone: 0,
    });
  });
});

// ───────────── groupByWeek ─────────────

describe("groupByWeek", () => {
  const today = "2026-11-19"; // четвер

  it("групує з понеділка: цей, минулий і раніші тижні від найновішого", () => {
    const groups = groupByWeek(
      [
        workout({ id: "a", dayKey: "2026-11-16" }), // пн цього тижня
        workout({ id: "b", dayKey: "2026-11-19" }),
        workout({ id: "c", dayKey: "2026-11-15" }), // нд минулого тижня
        workout({ id: "d", dayKey: "2026-11-09" }), // пн минулого тижня
        workout({ id: "e", dayKey: "2026-11-08" }), // нд позаминулого
      ],
      today,
    );
    expect(groups.map((g) => [g.weekStart, g.kind, g.workouts.map((w) => w.id)])).toEqual([
      ["2026-11-16", "this", ["b", "a"]],
      ["2026-11-09", "last", ["c", "d"]],
      ["2026-11-02", "earlier", ["e"]],
    ]);
    expect(groups[0].weekEnd).toBe("2026-11-22");
  });

  it("тиждень на межі місяців — одна група (27 жовт. – 2 лист.)", () => {
    const groups = groupByWeek(
      [workout({ id: "oct", dayKey: "2026-10-27" }), workout({ id: "nov", dayKey: "2026-11-01" })],
      today,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ weekStart: "2026-10-26", weekEnd: "2026-11-01", kind: "earlier" });
  });

  it("тиждень на межі років", () => {
    const groups = groupByWeek([workout({ id: "x", dayKey: "2027-01-01" })], "2027-01-03");
    expect(groups[0]).toMatchObject({ weekStart: "2026-12-28", kind: "this" });
  });
});

// ───────────── monthSummary ─────────────

describe("monthSummary", () => {
  it("сумує тренування, тоннаж і рекорди", () => {
    expect(
      monthSummary([
        { stats: { durationMinutes: 60, volumeKg: 8450.5, setsDone: 22 }, prCount: 2 },
        { stats: { durationMinutes: 58, volumeKg: 9120.2, setsDone: 20 }, prCount: 1 },
      ]),
    ).toEqual({ workouts: 2, volumeKg: 17570.7, records: 3 });
  });

  it("порожній місяць", () => {
    expect(monthSummary([])).toEqual({ workouts: 0, volumeKg: 0, records: 0 });
  });
});

// ───────────── Рекорди по тренуваннях ─────────────

describe("analyzeExerciseSessions", () => {
  it("перше тренування з вправою рекордів не дає", () => {
    const [first] = analyzeExerciseSessions([session("w1", "2026-11-02T10:00:00Z", done(80, 10), done(80, 10))]);
    expect(first.prFlags).toEqual([false, false]);
  });

  it("рекорд, побитий пізніше: кожне тренування порівнюється лише з історією ДО нього", () => {
    const analyzed = analyzeExerciseSessions([
      // навмисно не по порядку
      session("w3", "2026-11-16T10:00:00Z", done(85, 6), done(82.5, 10)),
      session("w1", "2026-11-02T10:00:00Z", done(80, 8)),
      session("w2", "2026-11-09T10:00:00Z", done(80, 10), done(80, 10)),
    ]);
    expect(analyzed.map((s) => s.workoutId)).toEqual(["w1", "w2", "w3"]);
    // w2: 80×10 б'є 1ПМ 80×8; другий такий самий підхід — уже ні
    expect(analyzed[1].prFlags).toEqual([true, false]);
    // w3: 85 кг — нова максимальна вага; 82,5×10 — новий 1ПМ (110 > 106,7)
    expect(analyzed[2].prFlags).toEqual([true, true]);
  });

  it("невиконаний підхід не може бути рекордом", () => {
    const analyzed = analyzeExerciseSessions([
      session("w1", "2026-11-02T10:00:00Z", done(80, 8)),
      session("w2", "2026-11-09T10:00:00Z", skipped(100, 10)),
    ]);
    expect(analyzed[1].prFlags).toEqual([false]);
  });

  it("розвантаження: вага не вища за рекомендовану алгоритмом після двох недоборів", () => {
    const params = { repMin: 8, repMax: 12, targetSets: 2, increment: 2.5 };
    const analyzed = analyzeExerciseSessions(
      [
        session("w1", "2026-11-02T10:00:00Z", done(100, 6), done(100, 5)),
        session("w2", "2026-11-05T10:00:00Z", done(100, 6), done(100, 6)),
        session("w3", "2026-11-09T10:00:00Z", done(90, 10), done(90, 9)),
        session("w4", "2026-11-12T10:00:00Z", done(90, 12), done(90, 12)),
      ],
      () => params,
    );
    expect(analyzed.map((s) => s.deload)).toEqual([false, false, true, false]);
  });

  it("без параметрів розвантаження не рахується", () => {
    const analyzed = analyzeExerciseSessions([
      session("w1", "2026-11-02T10:00:00Z", done(100, 6)),
      session("w2", "2026-11-05T10:00:00Z", done(100, 6)),
      session("w3", "2026-11-09T10:00:00Z", done(90, 10)),
    ]);
    expect(analyzed.every((s) => !s.deload)).toBe(true);
  });
});

describe("assembleWorkout", () => {
  it("переносить позначки рекордів і рахує кількість вправ з рекордом", () => {
    const analysis = new Map<string, AnalyzedSession[]>([
      [
        "bench",
        analyzeExerciseSessions([
          session("w1", "2026-11-02T10:00:00Z", done(80, 8)),
          session("w2", "2026-11-09T10:00:00Z", done(80, 10), skipped(80, 9)),
        ]),
      ],
      ["raise", analyzeExerciseSessions([session("w2", "2026-11-09T10:00:00Z", done(12, 15))])],
    ]);
    const raw: RawHistoryWorkout = {
      id: "w2",
      name: "Push",
      programId: "p1",
      programDayId: "d1",
      startedAt: "2026-11-09T10:00:00Z",
      finishedAt: "2026-11-09T11:05:00Z",
      notes: null,
      dayKey: "2026-11-09",
      exercises: [
        { meta: meta("bench"), sets: [{ setNumber: 1, ...done(80, 10) }, { setNumber: 2, ...skipped(80, 9) }] },
        { meta: meta("raise"), sets: [{ setNumber: 1, ...done(12, 15) }] },
      ],
    };
    const w = assembleWorkout(raw, analysis);
    expect(w.exercises[0].sets.map((s) => s.isPR)).toEqual([true, false]);
    expect(w.exercises[0].sets[1].e1rm).toBe(0);
    expect(w.exercises[1].hasPR).toBe(false);
    expect(w.prCount).toBe(1);
    expect(w.stats).toEqual({ durationMinutes: 65, volumeKg: 800 + 180, setsDone: 2 });
    expect(w.notes).toBe("");
  });
});

// ───────────── recentRecords ─────────────

describe("recentRecords", () => {
  it("найкращий рекордний підхід тренування, від найновішого, не більше limit", () => {
    const analysis = new Map<string, AnalyzedSession[]>([
      [
        "bench",
        analyzeExerciseSessions([
          session("w1", "2026-11-02T10:00:00Z", done(80, 8)),
          session("w2", "2026-11-09T10:00:00Z", done(80, 10), done(82.5, 9)),
          session("w4", "2026-11-19T10:00:00Z", done(85, 8)),
        ]),
      ],
      [
        "squat",
        analyzeExerciseSessions([
          session("w0", "2026-10-30T10:00:00Z", done(100, 5)),
          session("w3", "2026-11-12T10:00:00Z", done(105, 5)),
        ]),
      ],
    ]);
    const records = recentRecords(analysis, 3);
    expect(records.map((r) => [r.workoutId, r.exerciseId, r.weight, r.reps])).toEqual([
      ["w4", "bench", 85, 8],
      ["w3", "squat", 105, 5],
      ["w2", "bench", 82.5, 9], // 82,5×9 (107,25) > 80×10 (106,7)
    ]);
    expect(recentRecords(analysis, 1)).toHaveLength(1);
  });

  it("без рекордів — порожньо", () => {
    const analysis = new Map([["bench", analyzeExerciseSessions([session("w1", "2026-11-02T10:00:00Z", done(80, 8))])]]);
    expect(recentRecords(analysis)).toEqual([]);
  });
});

// ───────────── filterWorkouts ─────────────

describe("filterWorkouts", () => {
  const list = [
    workout({
      id: "push",
      dayKey: "2026-11-19",
      name: "Жим — Push",
      programId: "p1",
      notes: "плече трохи тягнуло",
      exercises: [{ ...meta("bench", "Bench Press", "Жим штанги лежачи"), sets: [], hasPR: false, deload: false }],
    }),
    workout({
      id: "legs",
      dayKey: "2026-11-16",
      name: "Ноги — Legs",
      programId: "p2",
      exercises: [{ ...meta("squat", "Back Squat", "Присідання зі штангою"), sets: [], hasPR: false, deload: false }],
    }),
  ];
  const ids = (f: Parameters<typeof filterWorkouts>[1]) => filterWorkouts(list, f).map((w) => w.id);

  it("за програмою, вправою і днем", () => {
    expect(ids({ programId: "p2" })).toEqual(["legs"]);
    expect(ids({ exerciseId: "bench" })).toEqual(["push"]);
    expect(ids({ day: "2026-11-16" })).toEqual(["legs"]);
    expect(ids({})).toEqual(["push", "legs"]);
  });

  it("пошук по назві дня, вправах (обидві мови) і нотатці", () => {
    expect(ids({ q: "legs" })).toEqual(["legs"]);
    expect(ids({ q: "bench" })).toEqual(["push"]);
    expect(ids({ q: "присід" })).toEqual(["legs"]);
    expect(ids({ q: "ПЛЕЧЕ" })).toEqual(["push"]);
    expect(ids({ q: "deadlift" })).toEqual([]);
  });
});

// ───────────── Місяці й URL ─────────────

describe("month helpers", () => {
  it("parseMonthParam / shiftMonth / monthBounds", () => {
    expect(parseMonthParam("2026-11")).toBe("2026-11");
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam(undefined)).toBeNull();
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthBounds("2028-02")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
    expect(historyRange("2026-11", 2)).toEqual({ first: "2026-09-01", last: "2026-11-30" });
  });

  it("queryBounds — запас у день з кожного боку", () => {
    expect(queryBounds("2026-11-01", "2026-11-30")).toEqual({
      from: "2026-10-31T00:00:00Z",
      to: "2026-12-02T00:00:00Z",
    });
    expect(queryBounds(null, "2026-11-30").from).toBeNull();
  });

  it("parseHistoryQuery відкидає некоректні значення; historyHref — назад", () => {
    const q = parseHistoryQuery(
      { month: "2026-11", program: "not-a-uuid", q: "  жим ", day: "2026-10-05", more: "99" },
      "2026-12",
    );
    expect(q).toEqual({ month: "2026-11", more: 24, program: null, exercise: null, q: "жим", day: null });
    expect(parseHistoryQuery({}, "2026-12").month).toBe("2026-12");
    expect(historyHref({ month: "2026-11", day: "2026-11-19", q: "жим" })).toBe(
      "/workouts/history?month=2026-11&q=%D0%B6%D0%B8%D0%BC&day=2026-11-19",
    );
  });
});

describe("часовий пояс користувача", () => {
  it("zonedTimeToISO ↔ toTimeKey (Київ, зима UTC+2, літо UTC+3)", () => {
    expect(zonedTimeToISO("2026-11-19", "18:10")).toBe("2026-11-19T16:10:00.000Z");
    expect(zonedTimeToISO("2026-07-01", "09:30")).toBe("2026-07-01T06:30:00.000Z");
    expect(toTimeKey("2026-11-19T16:10:00Z")).toBe("18:10");
  });

  it("wallClockDate — київський час як UTC (для Excel)", () => {
    expect(wallClockDate("2026-11-19T16:10:00Z").toISOString()).toBe("2026-11-19T18:10:00.000Z");
  });
});

// ───────────── Валідація форми редагування ─────────────

describe("editWorkoutSchema", () => {
  const valid = {
    workoutId: "8f6f2a52-6a39-4d39-9a0e-1f2d3c4b5a69",
    exercises: [
      {
        exerciseId: "2b9f4c1e-3d5a-4e6f-8a7b-9c0d1e2f3a4b",
        sets: [{ weightKg: 80, reps: 10, isCompleted: true, completedAt: null }],
      },
    ],
    notes: "ok",
    startedAt: "2026-11-19T16:10:00.000Z",
  };

  it("приймає коректні дані", () => {
    expect(editWorkoutSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["повтори > 100", { reps: 101 }, "editRepsRange"],
    ["дробові повтори", { reps: 8.5 }, "editRepsRange"],
    ["від'ємна вага", { weightKg: -1 }, "editWeightRange"],
    ["вага > 500 кг", { weightKg: 501 }, "editWeightRange"],
  ])("відхиляє: %s", (_, patch, code) => {
    const input = { ...valid, exercises: [{ ...valid.exercises[0], sets: [{ ...valid.exercises[0].sets[0], ...patch }] }] };
    const result = editWorkoutSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(code);
  });

  it("у вправи має бути хоча б один підхід", () => {
    const result = editWorkoutSchema.safeParse({ ...valid, exercises: [{ ...valid.exercises[0], sets: [] }] });
    expect(result.error?.issues[0].message).toBe("exerciseNeedsSet");
  });

  it("нотатка не довша за 2000 символів", () => {
    const result = editWorkoutSchema.safeParse({ ...valid, notes: "x".repeat(2001) });
    expect(result.error?.issues[0].message).toBe("notesTooLong");
  });
});

describe("parseEditDraft", () => {
  const draft = (sets: EditDraft["exercises"][number]["sets"]): EditDraft => ({
    exercises: [{ exerciseId: "bench", sets }],
    notes: "  нотатка  ",
    date: "2026-11-19",
    time: "18:10",
  });
  const set = (weight: string, reps: string, originalKg: number | null = null) => ({
    key: "k1",
    weight,
    reps,
    isCompleted: true,
    completedAt: null,
    originalKg,
  });

  it("переводить вагу з одиниць користувача в кг (кома як десятковий знак)", () => {
    const kg = parseEditDraft(draft([set("62,5", "10")]), "kg");
    expect(kg).toEqual({
      ok: true,
      value: {
        exercises: [{ exerciseId: "bench", sets: [{ weightKg: 62.5, reps: 10, isCompleted: true, completedAt: null }] }],
        notes: "нотатка",
      },
    });
    const lb = parseEditDraft(draft([set("135", "8")]), "lb");
    expect(lb.ok && lb.value.exercises[0].sets[0].weightKg).toBeCloseTo(61.235, 3);
  });

  it("без змін у полі lb повертає вихідні кг (без дрейфу)", () => {
    const result = parseEditDraft(draft([set("138", "8", 62.5)]), "lb");
    expect(result.ok && result.value.exercises[0].sets[0].weightKg).toBe(62.5);
  });

  it("помилки по полях", () => {
    const result = parseEditDraft(draft([set("abc", "101")]), "kg");
    expect(result).toEqual({ ok: false, errors: { "k1.weight": "editWeightRange", "k1.reps": "editRepsRange" } });
    expect(parseEditDraft(draft([]), "kg")).toEqual({ ok: false, errors: { "bench.sets": "exerciseNeedsSet" } });
    expect(parseEditDraft({ ...draft([set("80", "8")]), date: "" }, "kg")).toEqual({
      ok: false,
      errors: { date: "dateInvalid" },
    });
  });

  it("вага понад межу в lb", () => {
    expect(parseEditDraft(draft([set("1103", "5")]), "lb")).toMatchObject({ ok: false });
    expect(parseEditDraft(draft([set("1102", "5")]), "lb")).toMatchObject({ ok: true });
  });
});

// ───────────── Рядки для xlsx ─────────────

describe("buildExportRows", () => {
  const labels: ExportLabels = {
    workouts: { date: "Дата", day: "День", duration: "Тривалість, хв", sets: "Підходи", volume: "Тоннаж", records: "Рекорди", notes: "Нотатка" },
    sets: { date: "Дата", exercise: "Вправа", muscle: "Група", set: "Підхід", weight: "Вага", reps: "Повт", e1rm: "1ПМ", completed: "Виконано" },
    records: { exercise: "Вправа", result: "Вага × повт.", e1rm: "1ПМ", date: "Дата" },
    yes: "так",
    no: "ні",
    muscle: (g) => (g === "chest" ? "Груди" : g),
  };

  const w = workout({
    id: "w1",
    dayKey: "2026-11-19",
    name: "Жим — Push",
    startedAt: "2026-11-19T16:10:00Z",
    notes: "плече",
    stats: { durationMinutes: 65, volumeKg: 1580, setsDone: 2 },
    prCount: 1,
    exercises: [
      {
        ...meta("bench", "Bench Press", "Жим штанги лежачи"),
        hasPR: true,
        deload: false,
        sets: [
          { setNumber: 1, ...done(80, 10), isPR: true, e1rm: 106.67 },
          { setNumber: 2, ...done(78, 10), isPR: false, e1rm: 104 },
          { setNumber: 3, ...skipped(80, 0), isPR: false, e1rm: 0 },
        ],
      },
    ],
  });

  it("три аркуші з заголовками, вагою в одиницях користувача і датами в київському часі", () => {
    const sheets = buildExportRows([w], { unit: "kg", locale: "uk", labels });
    const date = new Date("2026-11-19T18:10:00.000Z");

    expect(sheets.workouts).toEqual([
      ["Дата", "День", "Тривалість, хв", "Підходи", "Тоннаж, кг", "Рекорди", "Нотатка"],
      [date, "Жим — Push", 65, 2, 1580, 1, "плече"],
    ]);
    expect(sheets.sets[0]).toEqual(["Дата", "Вправа", "Група", "Підхід", "Вага, кг", "Повт", "1ПМ, кг", "Виконано"]);
    expect(sheets.sets.slice(1)).toEqual([
      [date, "Жим штанги лежачи", "Груди", 1, 80, 10, 106.7, "так"],
      [date, "Жим штанги лежачи", "Груди", 2, 78, 10, 104, "так"],
      [date, "Жим штанги лежачи", "Груди", 3, 80, 0, null, "ні"],
    ]);
    expect(sheets.records).toEqual([
      ["Вправа", "Вага × повт.", "1ПМ, кг", "Дата"],
      ["Жим штанги лежачи", "80 × 10", 106.7, date],
    ]);
  });

  it("lb: колонки 'Weight, lb', значення перераховані", () => {
    const sheets = buildExportRows([w], { unit: "lb", locale: "en", labels: { ...labels, sets: { ...labels.sets, weight: "Weight" } } });
    expect(sheets.sets[0][4]).toBe("Weight, lb");
    expect(sheets.sets[1][1]).toBe("Bench Press");
    expect(sheets.sets[1][4]).toBe(176.5); // 80 кг → 176,4 lb → крок 0,5
    expect(sheets.workouts[1][4]).toBe(3483); // 1580 кг → lb
  });

  it("порожній експорт — лише заголовки; ширина колонок і назва файлу", () => {
    const sheets = buildExportRows([], { unit: "kg", locale: "uk", labels });
    expect(sheets.workouts).toHaveLength(1);
    // дата — 17 символів + 2 запасу; довгий текст обрізається до 60
    expect(columnWidths([["ab", null], [new Date(), "x".repeat(100)]])).toEqual([19, 60]);
    expect(exportFileName("2026-11")).toBe("gainstep-workouts-2026-11.xlsx");
    expect(exportFileName(null)).toBe("gainstep-workouts-all.xlsx");
  });
});
