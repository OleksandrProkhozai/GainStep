import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { REST_LIMITS } from "@/lib/profile/schema";
import { PreferencesProvider, type ClientPreferences } from "./preferences-provider";

const FALLBACK: ClientPreferences = { unit: "kg", minRestSeconds: REST_LIMITS.fallback, transitionRestEnabled: true };

/**
 * Серверна обгортка для layout: створює promise налаштувань (без await,
 * тож статична оболонка не чекає на сесію). Має стояти всередині <Suspense>.
 * Помилку (немає сесії → redirect) сторінка обробляє сама, тут — значення
 * за замовчуванням, щоб не показувати error boundary.
 */
export function UserPreferences({ children }: { children: ReactNode }) {
  const preferences = getCurrentUser().then(
    (user): ClientPreferences => ({
      unit: user.unit,
      minRestSeconds: user.minRestSeconds,
      transitionRestEnabled: user.transitionRestEnabled,
    }),
    () => FALLBACK,
  );
  return <PreferencesProvider preferences={preferences}>{children}</PreferencesProvider>;
}
