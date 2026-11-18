"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toDayKey } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { bodyWeightToKg, isDayKey, validateBodyWeight } from "./body-weight";

export type LogWeightResult =
  | { ok: true; weightKg: number; previousKg: number | null }
  | { ok: false; error: string };

export type DeleteWeightResult = { ok: true } | { ok: false; error: string };

const inputSchema = z.object({
  value: z.number(),
  unit: z.enum(["kg", "lb"]),
  date: z.string(),
});

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

/** Дата запису: справжня, не в майбутньому (в поясі користувача) і не давніша за 1900 рік. */
function checkDate(date: string): string | null {
  if (!isDayKey(date) || date < "1900-01-01") return "Pick a valid date";
  if (date > toDayKey(new Date())) return "You can't log weight for a future date";
  return null;
}

/**
 * Запис ваги тіла на вибрану дату. Один запис на день: якщо на цю дату
 * запис уже є — він оновлюється (upsert), а попереднє значення
 * повертається для повідомлення "Weight updated: 73 → 73.4 kg".
 * @param input.value вага в одиницях користувача (unit)
 */
export async function logBodyWeight(input: {
  value: number;
  unit: "kg" | "lb";
  date: string;
}): Promise<LogWeightResult> {
  const parsedInput = inputSchema.safeParse(input);
  if (!parsedInput.success) return { ok: false, error: "Invalid input" };
  const { value, unit, date } = parsedInput.data;

  const weight = validateBodyWeight(value, unit);
  if (!weight.ok) return weight;
  const dateError = checkDate(date);
  if (dateError) return { ok: false, error: dateError };

  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session has expired. Sign in again." };

  const { data: existing, error: readError } = await supabase
    .from("body_weight_entries")
    .select("weight")
    .eq("user_id", userId)
    .eq("recorded_on", date)
    .maybeSingle();
  if (readError) {
    console.error("logBodyWeight: read", readError);
    return { ok: false, error: "Couldn't save your weight. Please try again." };
  }

  const weightKg = bodyWeightToKg(weight.value, unit);
  const { error } = await supabase
    .from("body_weight_entries")
    .upsert(
      { user_id: userId, weight: weightKg, recorded_on: date },
      { onConflict: "user_id,recorded_on" },
    );
  if (error) {
    console.error("logBodyWeight: upsert", error);
    return { ok: false, error: "Couldn't save your weight. Please try again." };
  }

  revalidatePath("/progress");
  return { ok: true, weightKg, previousKg: existing ? Number(existing.weight) : null };
}

/** Видалення запису ваги за дату. */
export async function deleteBodyWeight(date: string): Promise<DeleteWeightResult> {
  if (typeof date !== "string" || !isDayKey(date)) return { ok: false, error: "Entry not found" };

  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session has expired. Sign in again." };

  const { error } = await supabase
    .from("body_weight_entries")
    .delete()
    .eq("user_id", userId)
    .eq("recorded_on", date);
  if (error) {
    console.error("deleteBodyWeight", error);
    return { ok: false, error: "Couldn't delete the entry. Please try again." };
  }

  revalidatePath("/progress");
  return { ok: true };
}
