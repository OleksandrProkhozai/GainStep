import { describe, expect, it } from "vitest";

import {
  buildSavePayload,
  dayStats,
  describeChanges,
  draftReducer,
  estimateDayMinutes,
  formatRest,
  formatScheme,
  isDraftDirty,
  nextDayName,
  patchExercise,
  reorder,
  type DraftExercise,
  type ProgramDraft,
} from "../programs/draft";
import { saveProgramSchema } from "../programs/schema";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const ex = (n: number, overrides: Partial<DraftExercise> = {}): DraftExercise => ({
  key: `k${n}`,
  id: uuid(100 + n),
  exerciseId: uuid(200 + n),
  name: `Ex ${n}`,
  nameUk: null,
  muscleGroup: "chest",
  equipment: "barbell",
  incrementKg: 2.5,
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  restSeconds: 90,
  ...overrides,
});

const saved = (): ProgramDraft => ({
  name: "PPL",
  days: [
    { key: "d1", id: uuid(1), name: "Push", exercises: [ex(1), ex(2), ex(3)] },
    { key: "d2", id: uuid(2), name: "Pull", exercises: [ex(4)] },
  ],
});

describe("estimateDayMinutes", () => {
  it("sets × (rest + 40 с), округлено до 5 хв", () => {
    // 3 × (90 + 40) = 390 с = 6.5 хв → 5
    expect(estimateDayMinutes([{ targetSets: 3, restSeconds: 90 }])).toBe(5);
    // 4 × 160 + 3 × 130 × 3 = 640 + 1170 = 1810 с ≈ 30.2 хв → 30
    expect(
      estimateDayMinutes([
        { targetSets: 4, restSeconds: 120 },
        { targetSets: 3, restSeconds: 90 },
        { targetSets: 3, restSeconds: 90 },
        { targetSets: 3, restSeconds: 90 },
      ]),
    ).toBe(30);
    // 7.5 хв → 10 (рівно посередині — вгору)
    expect(estimateDayMinutes([{ targetSets: 3, restSeconds: 110 }])).toBe(10);
  });

  it("порожній день і відпочинок 0", () => {
    expect(estimateDayMinutes([])).toBe(0);
    expect(estimateDayMinutes([{ targetSets: 10, restSeconds: 0 }])).toBe(5); // 400 с ≈ 6.7 хв
  });

  it("зведення дня та форматування", () => {
    expect(dayStats([ex(1, { targetSets: 4, restSeconds: 120 }), ex(2)])).toEqual({ exercises: 2, sets: 7, minutes: 15 });
    expect(dayStats([ex(1, { targetSets: 1 })])).toEqual({ exercises: 1, sets: 1, minutes: 0 });
    expect(formatRest(90)).toBe("1:30");
    expect(formatRest(600)).toBe("10:00");
    expect(formatRest(0)).toBe("0:00");
    expect(formatScheme({ targetSets: 4, repMin: 6, repMax: 10 })).toBe("4 × 6–10");
    expect(formatScheme({ targetSets: 5, repMin: 5, repMax: 5 })).toBe("5 × 5");
  });
});

describe("reorder", () => {
  it("переносить елемент і не змінює вхідний масив", () => {
    const list = ["a", "b", "c", "d"];
    expect(reorder(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(reorder(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });

  it("невалідні індекси — копія без змін", () => {
    expect(reorder(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(reorder(["a", "b"], -1, 0)).toEqual(["a", "b"]);
    expect(reorder(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});

describe("patchExercise — степери", () => {
  it("min і max повторень не перетинаються", () => {
    expect(patchExercise(ex(1), { repMin: 15 }).repMin).toBe(12);
    expect(patchExercise(ex(1), { repMax: 5 }).repMax).toBe(8);
  });

  it("межі підходів, повторень і відпочинку", () => {
    expect(patchExercise(ex(1), { targetSets: 11 }).targetSets).toBe(10);
    expect(patchExercise(ex(1), { targetSets: 0 }).targetSets).toBe(1);
    expect(patchExercise(ex(1, { repMin: 1 }), { repMin: 0 }).repMin).toBe(1);
    expect(patchExercise(ex(1, { repMax: 100 }), { repMax: 101 }).repMax).toBe(100);
    expect(patchExercise(ex(1), { restSeconds: 615 }).restSeconds).toBe(600);
    expect(patchExercise(ex(1), { restSeconds: -15 }).restSeconds).toBe(0);
  });
});

describe("draftReducer", () => {
  it("додає день (до 7) і не видаляє останній", () => {
    let d: ProgramDraft = { name: "P", days: [{ key: "a", id: null, name: "Day 1", exercises: [] }] };
    expect(draftReducer(d, { type: "removeDay", dayKey: "a" }).days).toHaveLength(1);
    for (let i = 0; i < 10; i++) d = draftReducer(d, { type: "addDay", key: `n${i}`, name: nextDayName(d.days) });
    expect(d.days).toHaveLength(7);
    expect(d.days.map((x) => x.name)).toEqual(["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"]);
  });

  it("додавання вправ не дублює вже наявні в дні", () => {
    const d = draftReducer(saved(), {
      type: "addExercises",
      dayKey: "d1",
      exercises: [ex(1, { key: "x1", id: null }), ex(9, { key: "x9", id: null }), ex(9, { key: "x9b", id: null })],
    });
    expect(d.days[0].exercises.map((e) => e.key)).toEqual(["k1", "k2", "k3", "x9"]);
  });

  it("перестановка й зміна вправи", () => {
    let d = draftReducer(saved(), { type: "moveExercise", dayKey: "d1", from: 2, to: 0 });
    expect(d.days[0].exercises.map((e) => e.key)).toEqual(["k3", "k1", "k2"]);
    d = draftReducer(d, { type: "updateExercise", dayKey: "d1", key: "k1", patch: { targetSets: 4 } });
    expect(d.days[0].exercises[1].targetSets).toBe(4);
  });
});

describe("buildSavePayload / describeChanges", () => {
  it("payload: порядок = position, нові рядки з id = null, видалені відсутні", () => {
    const original = saved();
    let d = draftReducer(original, { type: "rename", name: " PPL v2 " });
    d = draftReducer(d, { type: "moveExercise", dayKey: "d1", from: 0, to: 2 }); // змінені позиції
    d = draftReducer(d, { type: "updateExercise", dayKey: "d1", key: "k2", patch: { repMax: 10 } }); // змінена
    d = draftReducer(d, { type: "removeExercise", dayKey: "d1", key: "k3" }); // видалена
    d = draftReducer(d, { type: "removeDay", dayKey: "d2" }); // видалений день
    d = draftReducer(d, { type: "addDay", key: "d3", name: "Legs" }); // новий день
    d = draftReducer(d, { type: "addExercises", dayKey: "d3", exercises: [ex(7, { key: "n7", id: null })] });

    const payload = buildSavePayload(d);
    expect(payload).toEqual({
      name: "PPL v2",
      days: [
        {
          id: uuid(1),
          name: "Push",
          exercises: [
            { id: uuid(102), exercise_id: uuid(202), target_sets: 3, rep_min: 8, rep_max: 10, rest_seconds: 90 },
            { id: uuid(101), exercise_id: uuid(201), target_sets: 3, rep_min: 8, rep_max: 12, rest_seconds: 90 },
          ],
        },
        {
          id: null,
          name: "Legs",
          exercises: [{ id: null, exercise_id: uuid(207), target_sets: 3, rep_min: 8, rep_max: 12, rest_seconds: 90 }],
        },
      ],
    });
    expect(saveProgramSchema.safeParse(payload).success).toBe(true);

    expect(describeChanges(original, d)).toEqual({
      renamed: true,
      addedDays: ["Legs"],
      removedDayIds: [uuid(2)],
      changedDayIds: [],
      addedExercises: [uuid(207)],
      removedExerciseIds: [uuid(103), uuid(104)],
      changedExerciseIds: [uuid(102), uuid(101)],
    });
  });

  it("перейменований і переставлений день — змінений", () => {
    const original = saved();
    let d = draftReducer(original, { type: "renameDay", dayKey: "d2", name: "Back" });
    d = { ...d, days: reorder(d.days, 1, 0) };
    expect(describeChanges(original, d).changedDayIds).toEqual([uuid(2), uuid(1)]);
  });

  it("isDraftDirty: зміни є / повернули як було / лише клієнтські ключі", () => {
    const original = saved();
    const changed = draftReducer(original, { type: "updateExercise", dayKey: "d1", key: "k1", patch: { targetSets: 4 } });
    expect(isDraftDirty(original, changed)).toBe(true);
    const back = draftReducer(changed, { type: "updateExercise", dayKey: "d1", key: "k1", patch: { targetSets: 3 } });
    expect(isDraftDirty(original, back)).toBe(false);
    const rekeyed = { ...original, days: original.days.map((x) => ({ ...x, key: `${x.key}-new` })) };
    expect(isDraftDirty(original, rekeyed)).toBe(false);
  });
});
