import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPostAuthPath, safeNextPath } from "@/lib/auth/redirects";

/**
 * Обробник повернення з Supabase (OAuth Google, підтвердження email,
 * відновлення пароля): обмінює code на сесію та редіректить на next або /.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const path = next ?? (await getPostAuthPath(supabase, data.user.id));
      return NextResponse.redirect(new URL(path, origin));
    }
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "auth_callback");
  return NextResponse.redirect(loginUrl);
}
