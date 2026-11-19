"use server";

import { revalidatePath } from "next/cache";
import { setLocaleCookie } from "@/lib/auth/locale";
import { createClient } from "@/lib/supabase/server";
import { profilePatchSchema, restSecondsSchema, toProfileColumns, type ProfilePatch } from "./schema";

/** error — код повідомлення (errors.*); текст підставляє клієнт. */
export type SettingsActionResult = { ok: true } | { ok: false; error: string };

const MIGRATION_HINT = "settingsNotSetUp";
const SESSION_EXPIRED = "sessionExpired";

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return userId ? { supabase, userId } : null;
}

/**
 * Налаштування впливають на всі екрани (unit, ім'я в шапці, таймер) —
 * інвалідуємо весь layout, а клієнт додатково робить router.refresh().
 */
function revalidateEverything() {
  revalidatePath("/", "layout");
}

/** Часткове оновлення профілю: пише лише передані (змінені) поля. */
export async function updateProfile(patch: ProfilePatch): Promise<SettingsActionResult> {
  const parsed = profilePatchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalidValue" };

  const auth = await requireUser();
  if (!auth) return { ok: false, error: SESSION_EXPIRED };

  const { error } = await auth.supabase
    .from("profiles")
    .update(toProfileColumns(parsed.data))
    .eq("id", auth.userId);
  if (error) {
    console.error("updateProfile", error);
    // Колонки default_rest_seconds ще немає.
    if (error.code === "PGRST204" || error.code === "42703") return { ok: false, error: MIGRATION_HINT };
    return { ok: false, error: "settingsSaveFailed" };
  }

  // Мова: cookie NEXT_LOCALE — щоб і сторінки входу після виходу, і
  // <html lang> одразу знали нову мову (профіль — для інших пристроїв).
  if (parsed.data.locale) await setLocaleCookie(parsed.data.locale);

  revalidateEverything();
  return { ok: true };
}

/** Таймер з налаштувань → rest_seconds усіх вправ у програмах користувача. */
export async function applyDefaultRest(
  seconds: number,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const parsed = restSecondsSchema.safeParse(seconds);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "restRange" };

  const auth = await requireUser();
  if (!auth) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await auth.supabase.rpc("apply_default_rest", { p_seconds: parsed.data });
  if (error) {
    console.error("applyDefaultRest", error);
    if (error.code === "PGRST202") return { ok: false, error: MIGRATION_HINT };
    return { ok: false, error: "applyRestFailed" };
  }

  revalidateEverything();
  return { ok: true, updated: data ?? 0 };
}

/**
 * Видалення акаунта: RPC delete_my_account (security definer, лише свій
 * auth.uid()), потім вихід — очищаємо cookies сесії. Навігацію на /login
 * і toast робить клієнт.
 */
export async function deleteAccount(): Promise<SettingsActionResult> {
  const auth = await requireUser();
  if (!auth) return { ok: false, error: SESSION_EXPIRED };

  const { error } = await auth.supabase.rpc("delete_my_account");
  if (error) {
    console.error("deleteAccount", error);
    if (error.code === "PGRST202") return { ok: false, error: MIGRATION_HINT };
    return { ok: false, error: "accountDeleteFailed" };
  }

  // Користувача вже немає — сервер auth може відповісти помилкою, але
  // локальні cookies сесії signOut очищає в будь-якому разі.
  await auth.supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  revalidateEverything();
  return { ok: true };
}
