import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Client = SupabaseClient<Database>;

/**
 * Робить програму активною, лише якщо в користувача активної ще немає
 * (умова — у самому UPDATE, без гонки «прочитав → записав»).
 * @returns true — програма стала активною; false — активна вже була (або помилка).
 */
export async function activateIfNone(supabase: Client, userId: string, programId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ active_program_id: programId })
    .eq("id", userId)
    .is("active_program_id", null)
    .select("id");
  if (error) {
    console.error("activateIfNone", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** Параметр URL редактора: нова програма, яку варто запропонувати зробити активною. */
export const OFFER_ACTIVATE_PARAM = "new";

/** Шлях редактора після створення: ?new=1 — якщо програма не стала активною автоматично. */
export function newProgramPath(programId: string, activated: boolean) {
  return activated ? `/programs/${programId}` : `/programs/${programId}?${OFFER_ACTIVATE_PARAM}=1`;
}

/** Власні програми користувача (без шаблонів), від найстаріших — для перемикача й порожнього стану. */
export async function listMyPrograms(supabase: Client, userId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("programs")
    .select("id, name")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}
