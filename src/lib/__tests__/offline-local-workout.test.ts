import { describe, expect, it } from "vitest";

import type { Session } from "../progression";
import { buildLocalSummary, buildLocalWorkoutInit, countUnsyncedSets, newWorkoutId } from "../offline/local-workout";
import { buildWorkoutSummary } from "../workout/summary";
import { initFromPersisted, parsePersistedWorkout, storageKey } from "../workout/store";
import type { OfflineKit } from "../workout/queries";
import type { WorkoutExercise, WorkoutSet } from "../workout/types";

const session = (weight: number, ...reps: number[]): Session => ({
  sets: reps.map((r) => ({ weight, reps: r, isCompleted: true })),
});

const exercise = (over: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  exerciseId: "bench",
  name: "Bench Press",
  nameUk: "Жим лежачи",
  muscleGroup: "chest",
  equipment: "barbell",
  increment: 2.5,
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  restSeconds: 90,
  history: [session(60, 12, 12, 12)],
  best: null,
  ...over,
});

const set = (over: Partial<WorkoutSet>): WorkoutSet => ({
  clientId: Math.random().toString(36),
  exerciseId: "bench",
  setNumber: 1,
  weightKg: 62.5,
  reps: 10,
  isCompleted: true,
  completedAt: "2026-11-23T10:10:00.000Z",
  tracked: true,
  ...over,
});

const kit: OfflineKit = {
  programId: "p1",
  programName: "Push Pull Legs",
  loadedAt: "2026-11-23T09:00:00.000Z",
  days: [
    { id: "day-push", name: "Push", exercises: [exercise()] },
    { id: "day-empty", name: "Rest", exercises: [] },
  ],
};

describe("старт тренування без мережі", () => {
  it("будує тренування з кешованого дня: id з клієнта, рядок у базі ще не створено", () => {
    const now = new Date("2026-11-23T10:00:00.000Z");
    const init = buildLocalWorkoutInit(kit, "day-push", "w-1", now);
    expect(init).toMatchObject({
      workoutId: "w-1",
      name: "Push",
      programName: "Push Pull Legs",
      startedAt: now.toISOString(),
      created: false,
      programDayId: "day-push",
      planStored: false,
      savedSets: [],
    });
    expect(init?.exercises[0].history).toHaveLength(1); // підказки ваги / "Минулого разу"
  });

  it("немає кешу, дня або вправ — null", () => {
    const now = new Date();
    expect(buildLocalWorkoutInit(null, "day-push", "w", now)).toBeNull();
    expect(buildLocalWorkoutInit(kit, "missing", "w", now)).toBeNull();
    expect(buildLocalWorkoutInit(kit, "day-empty", "w", now)).toBeNull();
  });

  it("newWorkoutId — UUID v4", () => {
    expect(newWorkoutId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("лічильник непідтверджених підходів", () => {
  const sets = [
    set({ exerciseId: "bench", setNumber: 1 }),
    set({ exerciseId: "bench", setNumber: 2 }),
    set({ exerciseId: "bench", setNumber: 3, tracked: false, isCompleted: false }),
    set({ exerciseId: "row", setNumber: 1 }),
  ];

  it("рахує підходи з рядком у базі у вправах із черги", () => {
    expect(countUnsyncedSets({ sets, pending: { bench: 2 } })).toBe(2);
    expect(countUnsyncedSets({ sets, pending: {} })).toBe(0);
  });

  it("тренування ще не створене на сервері — усі такі підходи", () => {
    expect(countUnsyncedSets({ sets, pending: {}, created: false })).toBe(3);
  });
});

describe("локальний підсумок зі стору", () => {
  const exercises = [exercise(), exercise({ exerciseId: "row", name: "Row", nameUk: "Тяга", history: [] })];
  const sets = [
    set({ exerciseId: "row", setNumber: 1, weightKg: 50, reps: 10 }),
    set({ exerciseId: "bench", setNumber: 2, weightKg: 62.5, reps: 11 }),
    set({ exerciseId: "bench", setNumber: 1, weightKg: 62.5, reps: 12 }),
    set({ exerciseId: "bench", setNumber: 3, weightKg: 62.5, reps: 9, isCompleted: false }),
    set({ exerciseId: "row", setNumber: 2, weightKg: null, isCompleted: false }),
  ];

  it("рахує ті самі показники, що й сервер (buildWorkoutSummary)", () => {
    const local = buildLocalSummary({ exercises, sets }, "2026-11-23T10:00:00.000Z", "2026-11-23T10:47:00.000Z");
    const server = buildWorkoutSummary({
      startedAt: "2026-11-23T10:00:00.000Z",
      finishedAt: "2026-11-23T10:47:00.000Z",
      exercises: exercises.map((e) => ({ ...e, history: e.history, best: e.best })),
      sets: [
        { exerciseId: "bench", weight: 62.5, reps: 12, isCompleted: true },
        { exerciseId: "bench", weight: 62.5, reps: 11, isCompleted: true },
        { exerciseId: "row", weight: 50, reps: 10, isCompleted: true },
      ],
      previous: null,
    });
    expect(local).toEqual(server);
    expect(local.durationMinutes).toBe(47);
    expect(local.setsDone).toBe(3);
    expect(local.volumeKg).toBe(62.5 * 12 + 62.5 * 11 + 50 * 10);
    expect(local.volumeChange).toBeNull(); // без мережі порівняти нема з чим
  });

  it("підходи — у порядку вправ тренування й номерів; назви — мовою інтерфейсу", () => {
    const local = buildLocalSummary(
      { exercises, sets },
      "2026-11-23T10:00:00.000Z",
      "2026-11-23T10:47:00.000Z",
      (e) => e.nameUk ?? e.name,
    );
    expect(local.exercises.map((e) => e.name)).toEqual(["Жим лежачи", "Тяга"]);
    expect(local.exercises[0].sets.map((s) => s.reps)).toEqual([12, 11]);
  });

  it("рекорд порівнюється з найкращим ДО тренування (best зі стору)", () => {
    const withBest = [exercise({ best: { maxWeight: 60, bestE1RM: 84 } }), exercises[1]];
    const local = buildLocalSummary(
      { exercises: withBest, sets },
      "2026-11-23T10:00:00.000Z",
      "2026-11-23T10:47:00.000Z",
    );
    expect(local.exercises[0].record).toMatchObject({ weight: 62.5, reps: 12 });
    expect(local.prCount).toBe(1);
  });
});

describe("стан тренування з localStorage", () => {
  const persisted = {
    state: {
      workoutId: "w-1",
      meta: { name: "Push", programName: "PPL", startedAt: "2026-11-23T10:00:00.000Z" },
      created: false,
      programDayId: "day-push",
      exercises: [exercise()],
      sets: [set({ completedAt: "2026-11-23T10:05:00.000Z" })],
      currentIndex: 0,
      notes: "ok",
      pending: { bench: 1 },
    },
    version: 1,
  };

  it("ключ стору містить id тренування", () => {
    expect(storageKey("w-1")).toBe("gainstep-workout-w-1");
  });

  it("розбирає збережений стан і будує дані екрана без сервера", () => {
    const state = parsePersistedWorkout(JSON.stringify(persisted), "w-1");
    expect(state).not.toBeNull();
    const init = initFromPersisted(state!, "Workout");
    expect(init).toMatchObject({
      workoutId: "w-1",
      name: "Push",
      programName: "PPL",
      startedAt: "2026-11-23T10:00:00.000Z",
      notes: "ok",
      created: false,
      programDayId: "day-push",
      savedSets: [],
    });
  });

  it("старий стан без meta: назва за замовчуванням, старт — перший виконаний підхід", () => {
    const { meta, created, programDayId, ...old } = persisted.state;
    void meta;
    void created;
    void programDayId;
    const init = initFromPersisted(parsePersistedWorkout(JSON.stringify({ state: old }), "w-1")!, "Workout");
    expect(init.name).toBe("Workout");
    expect(init.startedAt).toBe("2026-11-23T10:05:00.000Z");
    expect(init.created).toBe(true);
  });

  it("чужий id, порожній або зіпсований JSON — null", () => {
    expect(parsePersistedWorkout(JSON.stringify(persisted), "other")).toBeNull();
    expect(parsePersistedWorkout(null, "w-1")).toBeNull();
    expect(parsePersistedWorkout("{oops", "w-1")).toBeNull();
    expect(parsePersistedWorkout(JSON.stringify({ state: { ...persisted.state, exercises: [] } }), "w-1")).toBeNull();
  });
});
