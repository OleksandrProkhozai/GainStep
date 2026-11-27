import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

import { pickNextDay } from "../dashboard/queries";
import { activateIfNone, newProgramPath } from "../programs/active";
import { getWorkoutsHubData } from "../workout/hub-queries";

/**
 * Мінімальний фейк Supabase: from(table) повертає ланцюжок, що записує
 * виклики (select / eq / is / in / update …), а результат (await,
 * maybeSingle, single) віддає resolver таблиці за цими викликами.
 */
type Op = [method: string, ...args: unknown[]];
type Resolver = (ops: Op[]) => unknown;

function fakeSupabase(resolvers: Record<string, Resolver>, log: { table: string; ops: Op[] }[] = []) {
  const from = (table: string) => {
    const ops: Op[] = [];
    log.push({ table, ops });
    const result = () => Promise.resolve({ data: resolvers[table]?.(ops) ?? null, error: null });
    const chain: Record<string, unknown> = {
      then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => result().then(ok, fail),
      maybeSingle: result,
      single: result,
    };
    for (const m of ["select", "eq", "is", "in", "order", "limit", "update", "insert", "delete"]) {
      chain[m] = (...args: unknown[]) => {
        ops.push([m, ...args]);
        return chain;
      };
    }
    return chain;
  };
  return { from } as unknown as SupabaseClient<Database>;
}

const has = (ops: Op[], method: string, ...args: unknown[]) =>
  ops.some(([m, ...a]) => m === method && args.every((x, i) => a[i] === x));

describe("pickNextDay — лише історія активної програми", () => {
  const active = [{ id: "fb-a" }, { id: "fb-b" }];

  it("тренування за іншою програмою не зсувають «Наступне»", () => {
    // Від найновішого: два дні іншої програми, потім fb-a активної.
    const workouts = [{ program_day_id: "ppl-push" }, { program_day_id: "ppl-pull" }, { program_day_id: "fb-a" }];
    expect(pickNextDay(active, workouts)?.id).toBe("fb-b");
  });

  it("за активною програмою ще не тренувались — перший день, хоч інша історія є", () => {
    const workouts = [{ program_day_id: "ppl-legs" }, { program_day_id: null }, { program_day_id: "ul-upper" }];
    expect(pickNextDay(active, workouts)?.id).toBe("fb-a");
  });

  it("після перемикання програми — ротація нової, а не попередньої", () => {
    const ppl = [{ id: "push" }, { id: "pull" }, { id: "legs" }];
    const history = [{ program_day_id: "fb-a" }, { program_day_id: "push" }];
    expect(pickNextDay(ppl, history)?.id).toBe("pull");
    expect(pickNextDay(active, history)?.id).toBe("fb-b");
  });
});

describe("activateIfNone — автопризначення першої власної програми", () => {
  it("активної ще немає → програма стає активною (умова is null у самому UPDATE)", async () => {
    const log: { table: string; ops: Op[] }[] = [];
    const supabase = fakeSupabase({ profiles: () => [{ id: "user-1" }] }, log);

    await expect(activateIfNone(supabase, "user-1", "prog-1")).resolves.toBe(true);
    const { ops } = log.find((l) => l.table === "profiles")!;
    expect(has(ops, "update")).toBe(true);
    expect(ops.find(([m]) => m === "update")?.[1]).toEqual({ active_program_id: "prog-1" });
    expect(has(ops, "eq", "id", "user-1")).toBe(true);
    expect(has(ops, "is", "active_program_id", null)).toBe(true);
  });

  it("активна вже є → UPDATE не зачіпає рядків, повертає false", async () => {
    const supabase = fakeSupabase({ profiles: () => [] });
    await expect(activateIfNone(supabase, "user-1", "prog-2")).resolves.toBe(false);
  });

  it("шлях редактора: стала активною — без пропозиції, інакше ?new=1", () => {
    expect(newProgramPath("p1", true)).toBe("/programs/p1");
    expect(newProgramPath("p1", false)).toBe("/programs/p1?new=1");
  });
});

describe("getWorkoutsHubData — порожній стан без активної програми", () => {
  const myPrograms = [
    { id: "mine-1", name: "НОВЕ ФУЛЛБАДІ" },
    { id: "mine-2", name: "Upper / Lower" },
  ];
  const resolvers: Record<string, Resolver> = {
    // Активну програму видалили: profiles.active_program_id → null (on delete set null).
    profiles: () => ({ program: null }),
    workouts: (ops) => (has(ops, "eq", "status", "in_progress") ? null : []),
    // Шаблони (owner_id is null) — лише для назв; власні — eq owner_id.
    programs: (ops) =>
      has(ops, "is", "owner_id", null)
        ? [{ name: "Full Body", name_uk: "Все тіло", program_days: [] }]
        : has(ops, "eq", "owner_id", "user-1")
          ? myPrograms
          : [],
    workout_sets: () => [],
  };

  it("program = null (шаблон не підставляється), власні програми — для вибору", async () => {
    const data = await getWorkoutsHubData(fakeSupabase(resolvers), "user-1", "uk");
    expect(data.program).toBeNull();
    expect(data.myPrograms).toEqual(myPrograms);
  });

  it("власних програм немає — порожній список (звичайний стан «Програми ще немає»)", async () => {
    const data = await getWorkoutsHubData(
      fakeSupabase({ ...resolvers, programs: () => [] }),
      "user-1",
    );
    expect(data.program).toBeNull();
    expect(data.myPrograms).toEqual([]);
  });

  it("активна є — бейдж «Наступне» за історією саме цієї програми", async () => {
    const data = await getWorkoutsHubData(
      fakeSupabase({
        ...resolvers,
        profiles: () => ({
          program: {
            id: "mine-1",
            name: "НОВЕ ФУЛЛБАДІ",
            program_days: [
              { id: "d1", name: "A", position: 0, program_exercises: [] },
              { id: "d2", name: "B", position: 1, program_exercises: [] },
            ],
          },
        }),
        // Запит «останнє тренування програми» фільтрує in("program_day_id", дні програми).
        workouts: (ops) =>
          has(ops, "eq", "status", "in_progress")
            ? null
            : ops.some(([m, col]) => m === "in" && col === "program_day_id")
              ? [{ program_day_id: "d1" }]
              : [],
      }),
      "user-1",
    );
    expect(data.program?.days.map((d) => [d.id, d.isNext])).toEqual([
      ["d1", false],
      ["d2", true],
    ]);
  });
});
