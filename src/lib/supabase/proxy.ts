import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/** Маршрути, доступні без сесії. */
const PUBLIC_PATHS = ["/login", "/forgot-password"];
const PUBLIC_PREFIXES = ["/auth/"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/**
 * Оновлює сесію Supabase (рефреш токенів у cookies) і робить
 * оптимістичні редіректи. Офіційний патерн @supabase/ssr.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Між createServerClient і getClaims() не додавайте жодної логіки:
  // це може спричинити випадкові виходи з акаунта.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Переносимо оновлені cookies сесії в редірект.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!claims) {
    return isPublicPath(pathname) ? response : redirectTo("/login");
  }

  // Далі — перевірка онбордингу. Запит до profiles робимо лише для
  // навігацій на сторінки, а не для статики, Server Actions чи API.
  const needsOnboardingCheck =
    pathname === "/login" ||
    (!isPublicPath(pathname) && !ONBOARDING_EXEMPT_PATHS.includes(pathname));
  if (!needsOnboardingCheck || !isPageRequest(request)) {
    return response;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", claims.sub)
    .maybeSingle();
  // Якщо БД недоступна — не редіректимо (щоб не зациклитись);
  // сторінки самі перевіряють стан через getCurrentUser().
  if (error) return response;

  const onboarded = Boolean(profile?.onboarded_at);

  if (pathname === "/login") {
    return redirectTo(onboarded ? "/" : "/onboarding");
  }
  if (!onboarded && pathname !== "/onboarding") {
    return redirectTo("/onboarding");
  }
  if (onboarded && pathname === "/onboarding") {
    return redirectTo("/");
  }

  return response;
}

/**
 * Захищені сторінки, доступні без онбордингу:
 * скидання пароля працює через лист і не має вести на /onboarding.
 */
const ONBOARDING_EXEMPT_PATHS = ["/reset-password"];

/** Звичайна навігація на сторінку: GET/HEAD без розширення файлу і не API. */
function isPageRequest(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (pathname.startsWith("/api/")) return false;
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  return !lastSegment.includes(".");
}
