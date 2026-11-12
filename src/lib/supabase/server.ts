import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Supabase-клієнт для Server Components, Server Actions і Route Handlers.
 * Створюйте новий клієнт на кожен запит — не шарте між запитами.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Виклик із Server Component: там cookies не записати.
            // Це безпечно, бо сесію оновлює proxy (src/proxy.ts).
          }
        },
      },
    },
  );
}
