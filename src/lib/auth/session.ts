import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Поточний користувач для Server Components (Data Access Layer).
 * Читає cookies, тому викликати лише всередині <Suspense>.
 */
export async function getCurrentUser() {
  // Supabase перевіряє термін дії токена через Date.now(), що заборонено
  // під час пререндеру (Cache Components) — тож чекаємо реального запиту.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarded_at")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: claims.email ?? null,
    displayName: profile?.display_name ?? null,
    onboarded: Boolean(profile?.onboarded_at),
  };
}
