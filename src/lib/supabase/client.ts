import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/** Supabase-клієнт для Client Components (браузер). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
