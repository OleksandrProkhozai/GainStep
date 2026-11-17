import { describe, expect, it } from "vitest";

import {
  detectPRs,
  historyBest,
  isPR,
  markPRs,
  suggestNextWeight,
  workingSets,
  type ProgressionInput,
  type Session,
  type SetResult,
} from "../progression";

// ───────────── Допоміжні фабрики тестових даних ─────────────

/** Виконаний підхід. */
const done = (weight: number, reps: number): SetResult => ({
  weight,
  reps,
  isCompleted: true,
});

/** Невиконаний підхід. */
const skipped = (weight: number, reps: number): SetResult => ({
  weight,
  reps,
  isCompleted: false,
});

/** Тренування з однаковою вагою: session(60, 12, 12, 12). */
const session = (weight: number, ...reps: number[]): Session => ({
  sets: reps.map((r) => done(weight, r)),
});

/** Стандартні параметри: діапазон 8–12, 3 підходи, крок 2.5 кг. */
const suggest = (history: Session[], overrides: Partial<ProgressionInput> = {}) =>
  suggestNextWeight({
    history,
    repMin: 8,
    repMax: 12,
    targetSets: 3,
    increment: 2.5,
    ...overrides,
  });

// ───────────────────────── Прогресія ─────────────────────────

describe("suggestNextWeight — none", () => {
  it("порожня історія", () => {
    expect(suggest([])).toEqual({
      action: "none",
      weight: null,
      delta: 0,
      reason: "No history yet — pick a starting weight",
    });
  });

  it("в останньому тренуванні немає виконаних підходів", () => {
    const history: Session[] = [
      { sets: [skipped(60, 12), skipped(60, 12)] },
      session(60, 12, 12, 12),
    ];
    expect(suggest(history).action).toBe("none");
    expect(suggest(history).weight).toBeNull();
  });

  it("останнє тренування взагалі без підходів", () => {
    expect(suggest([{ sets: [] }]).action).toBe("none");
  });
});

describe("suggestNextWeight — increase", () => {
  it("60 × 12, 12, 12 при 8–12 → 62.5 (+2.5)", () => {
    expect(suggest([session(60, 12, 12, 12)])).toEqual({
      action: "increase",
      weight: 62.5,
      delta: 2.5,
      reason: "All sets reached 12 reps last time",
    });
  });

  it("крок 5 для присідань: 100 × 12, 12, 12 → 105", () => {
    const s = suggest([session(100, 12, 12, 12)], { increment: 5 });
    expect(s.action).toBe("increase");
    expect(s.weight).toBe(105);
    expect(s.delta).toBe(5);
  });

  it("повторень більше за repMax теж рахується", () => {
    expect(suggest([session(60, 13, 12, 14)]).action).toBe("increase");
  });

  it("розминкові (легші) підходи не заважають", () => {
    const history: Session[] = [
      { sets: [done(40, 5), done(60, 12), done(60, 12), done(60, 12)] },
    ];
    expect(suggest(history).weight).toBe(62.5);
  });

  it("невиконаний підхід ігнорується", () => {
    const history: Session[] = [
      { sets: [done(60, 12), done(60, 12), done(60, 12), skipped(60, 3)] },
    ];
    expect(suggest(history).action).toBe("increase");
  });

  it("без похибок float: 0.1 + 0.2 кг кроками 0.1", () => {
    const s = suggest([session(0.2, 12, 12, 12)], { increment: 0.1 });
    expect(s.weight).toBe(0.3);
    expect(s.delta).toBe(0.1);
  });
});

describe("suggestNextWeight — same", () => {
  it("62.5 × 10, 9, 8 → залишити 62.5", () => {
    expect(suggest([session(62.5, 10, 9, 8)])).toEqual({
      action: "same",
      weight: 62.5,
      delta: 0,
      reason: "Keep 62.5 kg until all sets reach 12 reps",
    });
  });

  it("виконано менше targetSets підходів, хоч і по 12 повторень", () => {
    const s = suggest([session(60, 12, 12)]);
    expect(s.action).toBe("same");
    expect(s.weight).toBe(60);
  });

  it("підходи з робочою вагою рахуються окремо від легших", () => {
    // 3 підходи по 12, але з робочою вагою 60 лише два.
    const history: Session[] = [
      { sets: [done(55, 12), done(60, 12), done(60, 12)] },
    ];
    expect(suggest(history).action).toBe("same");
  });
});

describe("suggestNextWeight — deload", () => {
  it("два тренування поспіль з підходом < repMin → 57.5 з 62.5", () => {
    const history = [session(62.5, 9, 7, 6), session(62.5, 10, 8, 7)];
    expect(suggest(history)).toEqual({
      action: "deload",
      weight: 57.5,
      delta: -5,
      reason: "Below 8 reps two sessions in a row — deload −10%",
    });
  });

  it("лише одне таке тренування → same", () => {
    const history = [session(62.5, 9, 7, 6), session(62.5, 10, 9, 8)];
    expect(suggest(history).action).toBe("same");
  });

  it("лише одне тренування в історії (з недобором) → same", () => {
    expect(suggest([session(62.5, 7, 6, 5)]).action).toBe("same");
  });

  it("недобір у попередньому, але не в останньому → same", () => {
    const history = [session(62.5, 10, 9, 8), session(62.5, 7, 6, 5)];
    expect(suggest(history).action).toBe("same");
  });

  it("попереднє тренування без виконаних підходів не рахується як недобір", () => {
    const history: Session[] = [
      session(62.5, 7, 6, 5),
      { sets: [skipped(62.5, 0)] },
    ];
    expect(suggest(history).action).toBe("same");
  });

  it("маленька вага: −10% менше за крок → мінус один крок (10 → 7.5)", () => {
    // 0.9 × 10 = 9 → округлення до 2.5 дало б знову 10.
    const history = [session(10, 6, 6, 6), session(10, 7, 6, 6)];
    const s = suggest(history);
    expect(s.action).toBe("deload");
    expect(s.weight).toBe(7.5);
    expect(s.delta).toBe(-2.5);
  });

  it("результат не від'ємний (2 кг при кроці 2.5 → 0)", () => {
    const history = [session(2, 5, 5, 5), session(2, 5, 5, 5)];
    const s = suggest(history);
    expect(s.action).toBe("deload");
    expect(s.weight).toBe(0);
    expect(s.delta).toBe(-2);
  });

  it("велика вага з кроком 5: 100 → 90", () => {
    const history = [session(100, 5, 5, 5), session(100, 6, 5, 5)];
    expect(suggest(history, { increment: 5 }).weight).toBe(90);
  });
});

describe("suggestNextWeight — пріоритет", () => {
  it("increase має пріоритет над deload", () => {
    // За коректного діапазону (repMin ≤ repMax) умови взаємовиключні:
    // якщо всі робочі підходи ≥ repMax, то жоден не < repMin.
    // Колізія можлива лише при помилковому налаштуванні repMin > repMax —
    // саме його й моделюємо: repMin = 13, repMax = 12. Тоді обидва
    // тренування мають підходи < repMin (умова deload), а останнє — усі
    // підходи ≥ repMax (умова increase). Має перемогти increase.
    const history = [session(60, 12, 12, 12), session(60, 5, 5, 5)];
    const s = suggest(history, { repMin: 13, repMax: 12 });
    expect(s.action).toBe("increase");
    expect(s.weight).toBe(62.5);
  });
});

describe("workingSets", () => {
  it("повертає найбільшу вагу і підходи з нею", () => {
    expect(workingSets({ sets: [done(40, 10), done(60, 8), done(60, 7)] })).toEqual({
      weight: 60,
      sets: [done(60, 8), done(60, 7)],
    });
  });

  it("undefined або без виконаних підходів → null", () => {
    expect(workingSets(undefined)).toBeNull();
    expect(workingSets({ sets: [skipped(60, 8)] })).toBeNull();
  });
});

// ───────────────────────── Рекорди ─────────────────────────

describe("historyBest", () => {
  it("порожня історія → null", () => {
    expect(historyBest([])).toBeNull();
  });

  it("лише невиконані підходи або 0 повторень → null", () => {
    expect(historyBest([{ sets: [skipped(100, 5), done(100, 0)] }])).toBeNull();
  });

  it("максимальна вага і 1ПМ можуть бути з різних підходів", () => {
    // 70 × 1 → 1ПМ 70; 60 × 12 → 1ПМ 84.
    expect(historyBest([session(70, 1), session(60, 12)])).toEqual({
      maxWeight: 70,
      bestE1RM: 84,
    });
  });
});

describe("isPR", () => {
  const best = { maxWeight: 60, bestE1RM: 84 };

  it("немає історії → не рекорд", () => {
    expect(isPR(done(200, 10), null)).toBe(false);
  });

  it("вища вага → рекорд", () => {
    expect(isPR(done(62.5, 1), best)).toBe(true);
  });

  it("та сама вага, більше повторень → рекорд за 1ПМ", () => {
    expect(isPR(done(60, 13), best)).toBe(true);
  });

  it("та сама вага і повторення → не рекорд", () => {
    expect(isPR(done(60, 12), best)).toBe(false);
  });

  it("невиконаний підхід або 0 повторень → не рекорд", () => {
    expect(isPR(skipped(100, 10), best)).toBe(false);
    expect(isPR(done(100, 0), best)).toBe(false);
  });
});

describe("detectPRs", () => {
  it("перше тренування — без рекордів", () => {
    expect(detectPRs([done(60, 12), done(60, 12)], [])).toEqual([false, false]);
  });

  it("вища вага → PR", () => {
    expect(detectPRs([done(62.5, 10)], [session(60, 12, 12, 12)])).toEqual([true]);
  });

  it("та сама вага, більше повторень → PR за 1ПМ", () => {
    expect(detectPRs([done(60, 13)], [session(60, 12, 12, 12)])).toEqual([true]);
  });

  it("повторний такий самий підхід уже не PR", () => {
    expect(
      detectPRs(
        [done(62.5, 12), done(62.5, 12), done(62.5, 12)],
        [session(60, 12, 12, 12)],
      ),
    ).toEqual([true, false, false]);
  });

  it("підхід, кращий за попередній рекорд у цьому ж тренуванні, — знову PR", () => {
    expect(
      detectPRs([done(62.5, 10), done(62.5, 12)], [session(60, 12, 12, 12)]),
    ).toEqual([true, true]);
  });

  it("невиконані підходи не рекорди й не оновлюють best", () => {
    expect(
      detectPRs([skipped(80, 10), done(62.5, 10)], [session(60, 12, 12, 12)]),
    ).toEqual([false, true]);
  });

  it("гірший підхід → не PR", () => {
    expect(detectPRs([done(55, 10)], [session(60, 12, 12, 12)])).toEqual([false]);
  });
});

describe("markPRs", () => {
  it("дає той самий результат, що й detectPRs, з готовим best", () => {
    const history = [session(60, 12, 12, 12)];
    const sets = [done(62.5, 12), done(62.5, 12), done(60, 13)];
    expect(markPRs(sets, historyBest(history))).toEqual(detectPRs(sets, history));
  });

  it("best = null → жодного рекорду", () => {
    expect(markPRs([done(100, 10)], null)).toEqual([false]);
  });
});
