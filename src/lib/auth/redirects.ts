import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Куди вести користувача після входу:
 * /onboarding, якщо profiles.onboarded_at порожнє, інакше на /.
 */
export async function getPostAuthPath(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<"/" | "/onboarding"> {
  const { data } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", userId)
    .maybeSingle();

  return data?.onboarded_at ? "/" : "/onboarding";
}

/** Дозволяє лише внутрішні шляхи (захист від open redirect). */
export function safeNextPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next;
}
