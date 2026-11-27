import { describe, expect, it } from "vitest";

import {
  DELOAD_MIN_FAILED_SETS,
  DELOAD_REP_SHORTFALL,
  DELOAD_SESSIONS,
  detectPRs,
  failedSetsNeeded,
  failRepsThreshold,
  historyBest,
  isFailedSession,
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

  it("тренування, де вправу пропустили (лише невиконані підходи), ігнорується — береться попереднє", () => {
    const history: Session[] = [
      { sets: [skipped(60, 12), skipped(60, 12)] },
      session(60, 12, 12, 12),
    ];
    expect(suggest(history).action).toBe("increase");
    expect(suggest(history).weight).toBe(62.5);
  });

  it("лише тренування без виконаних підходів → none", () => {
    const history: Session[] = [{ sets: [skipped(60, 12), skipped(60, 12)] }];
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

describe("правило розвантаження — константи й невдале тренування", () => {
  it("константи: недобір 2, мінімум 2 підходи, 2 тренування поспіль", () => {
    expect(DELOAD_REP_SHORTFALL).toBe(2);
    expect(DELOAD_MIN_FAILED_SETS).toBe(2);
    expect(DELOAD_SESSIONS).toBe(2);
    expect(failRepsThreshold(8)).toBe(6);
  });

  it("min(2, targetSets): 1 підхід → 1, 2 → 2, 5 → 2", () => {
    expect(failedSetsNeeded(1)).toBe(1);
    expect(failedSetsNeeded(2)).toBe(2);
    expect(failedSetsNeeded(5)).toBe(2);
  });

  it("isFailedSession при 8–12 × 3", () => {
    expect(isFailedSession(session(60, 7, 6, 6), 8, 3)).toBe(true);
    expect(isFailedSession(session(60, 6, 6, 8), 8, 3)).toBe(true);
    expect(isFailedSession(session(60, 6, 9, 10), 8, 3)).toBe(false); // лише один підхід ≤ 6
    expect(isFailedSession(session(60, 8, 8, 7), 8, 3)).toBe(false); // недобір 1
    expect(isFailedSession(session(60, 7, 7, 7), 8, 3)).toBe(false); // рівно repMin − 1
    expect(isFailedSession(session(60, 6, 6, 12), 8, 3)).toBe(true); // рівно repMin − 2
    expect(isFailedSession(undefined, 8, 3)).toBe(false);
  });

  it("рахуються лише робочі підходи: легші розминкові з малими reps не провалюють", () => {
    const s: Session = { sets: [done(40, 5), done(40, 5), done(60, 9), done(60, 8), done(60, 8)] };
    expect(isFailedSession(s, 8, 3)).toBe(false);
  });

  it("невиконані підходи не рахуються", () => {
    const s: Session = { sets: [done(60, 9), skipped(60, 3), skipped(60, 2)] };
    expect(isFailedSession(s, 8, 3)).toBe(false);
  });
});

describe("suggestNextWeight — deload", () => {
  it("два невдалі тренування поспіль → 57.5 з 62.5", () => {
    const history = [session(62.5, 7, 6, 6), session(62.5, 6, 6, 8)];
    expect(suggest(history)).toEqual({
      action: "deload",
      weight: 57.5,
      delta: -5,
      reason: "2 failed sessions in a row (≤ 6 reps) — deload −10%",
    });
  });

  it("старе правило: по одному підходу < repMin двічі поспіль — тепер same", () => {
    // 9/7/6 і 10/8/7: у кожному лише один підхід ≤ 6 → не невдалі тренування.
    const history = [session(62.5, 9, 7, 6), session(62.5, 10, 8, 7)];
    expect(suggest(history)).toMatchObject({ action: "same", weight: 62.5 });
  });

  it("недобір 1 повторення двічі поспіль → same (7/7/7, 7/7/7)", () => {
    expect(suggest([session(62.5, 7, 7, 7), session(62.5, 7, 7, 7)]).action).toBe("same");
  });

  it("межа: рівно repMin − 2 у двох підходах двічі → deload", () => {
    expect(suggest([session(60, 6, 6, 12), session(60, 12, 6, 6)]).action).toBe("deload");
  });

  it("межа: рівно repMin − 1 у всіх підходах двічі → same", () => {
    expect(suggest([session(60, 7, 7, 7), session(60, 7, 7, 7)]).action).toBe("same");
  });

  it("1 цільовий підхід: один підхід ≤ repMin − 2 двічі → deload", () => {
    const s = suggest([session(60, 6), session(60, 5)], { targetSets: 1 });
    expect(s.action).toBe("deload");
    expect(s.weight).toBe(55); // 0.9 × 60 = 54 → 55 (крок 2.5)
  });

  it("2 цільові підходи: потрібні обидва з сильним недобором", () => {
    expect(suggest([session(60, 6, 6), session(60, 6, 6)], { targetSets: 2 }).action).toBe("deload");
    expect(suggest([session(60, 6, 8), session(60, 6, 6)], { targetSets: 2 }).action).toBe("same");
  });

  it("лише одне невдале тренування → same", () => {
    const history = [session(62.5, 7, 6, 6), session(62.5, 10, 9, 8)];
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
    // якщо всі робочі підходи ≥ repMax, то жоден не ≤ repMin − 2.
    // Колізія можлива лише при помилковому налаштуванні repMin > repMax + 1 —
    // саме його й моделюємо: repMin = 14, repMax = 12. Тоді обидва
    // тренування невдалі (≥ 2 підходи ≤ 12, умова deload), а останнє — усі
    // підходи ≥ repMax (умова increase). Має перемогти increase.
    const history = [session(60, 12, 12, 12), session(60, 5, 5, 5)];
    const s = suggest(history, { repMin: 14, repMax: 12 });
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

describe("suggestNextWeight — тренажер / блок, крок 5 кг", () => {
  const machine = (history: Session[], equipment = "machine") => suggest(history, { increment: 5, equipment });

  it("increase: 40 × 12, 12, 12 → 45 (+5)", () => {
    const s = machine([session(40, 12, 12, 12)]);
    expect(s.action).toBe("increase");
    expect(s.weight).toBe(45);
    expect(s.delta).toBe(5);
  });

  it("same: 45 × 10, 9, 8 → 45", () => {
    const s = machine([session(45, 10, 9, 8)]);
    expect(s.action).toBe("same");
    expect(s.weight).toBe(45);
    expect(s.delta).toBe(0);
  });

  it("deload: 45 → 40 (−10% = 40.5, округлення до 5, не 42.5)", () => {
    const s = machine([session(45, 6, 6, 5), session(45, 7, 6, 6)]);
    expect(s.action).toBe("deload");
    expect(s.weight).toBe(40);
    expect(s.delta).toBe(-5);
  });

  it("deload мала вага: 20 → 15 (−10% = 18 округлилось би знову до 20)", () => {
    const s = machine([session(20, 6, 6, 5), session(20, 7, 6, 6)]);
    expect(s.weight).toBe(15);
  });

  it("deload велика вага: 80 → 70 (−10% = 72 → 70)", () => {
    const s = machine([session(80, 6, 6, 5), session(80, 7, 6, 6)]);
    expect(s.weight).toBe(70);
  });

  describe("вага в історії не кратна 5 (12.5 кг на блоці)", () => {
    it("increase → 15, а не 17.5", () => {
      const s = machine([session(12.5, 12, 12, 12)]);
      expect(s.action).toBe("increase");
      expect(s.weight).toBe(15);
      expect(s.delta).toBe(2.5);
    });

    it("same → 10, а не 12.5", () => {
      const s = machine([session(12.5, 10, 9, 8)]);
      expect(s.action).toBe("same");
      expect(s.weight).toBe(10);
      expect(s.delta).toBe(-2.5);
      expect(s.reason).toBe("Keep 10 kg until all sets reach 12 reps");
    });

    it("deload → 10, а не 7.5 чи 11.25", () => {
      const s = machine([session(12.5, 6, 6, 5), session(12.5, 7, 6, 6)]);
      expect(s.action).toBe("deload");
      expect(s.weight).toBe(10);
    });

    it("42.5 → increase 45, deload 40 (−10% = 38.25 → 40)", () => {
      expect(machine([session(42.5, 12, 12, 12)]).weight).toBe(45);
      expect(machine([session(42.5, 6, 6, 5), session(42.5, 7, 6, 6)]).weight).toBe(40);
    });
  });

  it("вага з lb (110 lb = 49.9 кг) вважається кратною: same лишає її, increase → 55", () => {
    const w = 110 * 0.45359237;
    expect(machine([session(w, 10, 9, 8)]).weight).toBe(w);
    expect(machine([session(w, 12, 12, 12)]).weight).toBe(55);
  });
});

describe("suggestNextWeight — вільна вага без прив'язки до сітки", () => {
  it("гантелі 22.5 при кроці 2: same лишає 22.5, increase → 24.5", () => {
    expect(suggest([session(22.5, 10, 9, 8)], { increment: 2, equipment: "dumbbell" }).weight).toBe(22.5);
    expect(suggest([session(22.5, 12, 12, 12)], { increment: 2, equipment: "dumbbell" }).weight).toBe(24.5);
  });

  it("блок і тренажер прив'язуються однаково", () => {
    const h = [session(12.5, 12, 12, 12)];
    expect(suggest(h, { increment: 5, equipment: "cable" }).weight).toBe(15);
    expect(suggest(h, { increment: 5, equipment: "machine" }).weight).toBe(15);
    expect(suggest(h, { increment: 5, equipment: "barbell" }).weight).toBe(17.5);
  });
});
