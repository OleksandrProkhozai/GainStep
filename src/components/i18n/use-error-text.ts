"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

/**
 * Код помилки (zod-схема, server action, Supabase Auth) → текст мовою
 * інтерфейсу. Невідомий код (наприклад, сирий текст бібліотеки) →
 * загальна помилка, щоб англійський текст не просочився в uk.
 */
export function useErrorText() {
  const t = useTranslations("errors");
  return useCallback(
    (code: string | null | undefined, values?: Record<string, string | number>): string | undefined => {
      if (!code) return undefined;
      // Ключі типізовані, а код приходить рядком — перевіряємо через has().
      const key = code as Parameters<typeof t>[0];
      return t.has(key) ? t(key, values as never) : t("generic");
    },
    [t],
  );
}
