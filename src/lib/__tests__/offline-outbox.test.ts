import { describe, expect, it, vi } from "vitest";

import {
  addFinish,
  applyFinishResults,
  findFinish,
  processFinishQueue,
  removeFinish,
  sendFinish,
  type FinishDeps,
  type FinishTask,
} from "../offline/outbox";

const task = (workoutId: string, over: Partial<FinishTask> = {}): FinishTask => ({
  workoutId,
  name: "Push Day",
  notes: "",
  finishedAt: "2026-11-23T10:00:00.000Z",
  ...over,
});

const deps = (over: Partial<FinishDeps> = {}): FinishDeps => ({
  syncSets: vi.fn(async () => true),
  complete: vi.fn(async () => ({ ok: true as const })),
  ...over,
});

describe("черга завершень: додавання", () => {
  it("додає тренування в кінець черги", () => {
    const q = addFinish(addFinish([], task("a")), task("b"));
    expect(q.map((t) => t.workoutId)).toEqual(["a", "b"]);
  });

  it("ідемпотентна за id: повторне «Завершити» не створює дубль і не змінює час", () => {
    const first = addFinish([], task("a", { finishedAt: "2026-11-23T10:00:00.000Z" }));
    const again = addFinish(first, task("a", { finishedAt: "2026-11-23T10:05:00.000Z" }));
    expect(again).toBe(first);
    expect(again).toHaveLength(1);
    expect(findFinish(again, "a")?.finishedAt).toBe("2026-11-23T10:00:00.000Z");
  });

  it("removeFinish прибирає лише своє; відсутній id — той самий масив", () => {
    const q = [task("a"), task("b")];
    expect(removeFinish(q, "a").map((t) => t.workoutId)).toEqual(["b"]);
    expect(removeFinish(q, "x")).toBe(q);
    expect(findFinish(q, "x")).toBeNull();
  });
});

describe("черга завершень: відправка", () => {
  it("спершу підходи, потім finishWorkout з часом і нотаткою з пристрою", async () => {
    const order: string[] = [];
    const d = deps({
      syncSets: vi.fn(async () => {
        order.push("sets");
        return true;
      }),
      complete: vi.fn(async () => {
        order.push("finish");
        return { ok: true as const };
      }),
    });
    const t = task("a", { notes: "легко" });
    expect(await sendFinish(t, d)).toEqual({ kind: "done" });
    expect(order).toEqual(["sets", "finish"]);
    expect(d.complete).toHaveBeenCalledWith(t);
  });

  it("підходи не відправились — finishWorkout не викликається, лишається в черзі", async () => {
    const d = deps({ syncSets: vi.fn(async () => false) });
    expect(await sendFinish(task("a"), d)).toEqual({ kind: "retry" });
    expect(d.complete).not.toHaveBeenCalled();
  });

  it("мережева помилка (throw) — retry без коду", async () => {
    const d = deps({
      complete: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });
    expect(await sendFinish(task("a"), d)).toEqual({ kind: "retry" });
  });

  it("тимчасова помилка сервера — retry з кодом; тренування немає — drop", async () => {
    expect(
      await sendFinish(task("a"), deps({ complete: async () => ({ ok: false, error: "workoutFinishFailed" }) })),
    ).toEqual({ kind: "retry", error: "workoutFinishFailed" });
    expect(
      await sendFinish(task("a"), deps({ complete: async () => ({ ok: false, error: "workoutNotFound" }) })),
    ).toEqual({ kind: "drop", error: "workoutNotFound" });
  });

  it("після успіху черга очищається, невдалі лишаються", async () => {
    const queue = [task("a"), task("b"), task("c")];
    const d = deps({
      complete: async (t) =>
        t.workoutId === "b" ? { ok: false, error: "workoutFinishFailed" } : { ok: true },
    });
    const results = await processFinishQueue(queue, d);
    expect(results.map((r) => [r.workoutId, r.attempt.kind])).toEqual([
      ["a", "done"],
      ["b", "retry"],
      ["c", "done"],
    ]);
    expect(applyFinishResults(queue, results).map((t) => t.workoutId)).toEqual(["b"]);
  });

  it("за час відправки в чергу додали нове — воно не губиться", async () => {
    const queue = [task("a")];
    const results = await processFinishQueue(queue, deps());
    const grown = addFinish(queue, task("b"));
    expect(applyFinishResults(grown, results).map((t) => t.workoutId)).toEqual(["b"]);
  });
});
