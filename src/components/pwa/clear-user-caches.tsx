"use client";

import { useEffect } from "react";
import { clearUserDeviceData } from "@/lib/offline/clear";

/**
 * Сторінка входу: користувач вийшов (або сесія закінчилась) — прибираємо
 * кешовані сторінки й дані акаунта, щоб на спільному пристрої наступний
 * користувач не побачив їх офлайн. Лише з мережею: офлайн /login може
 * відкритися з кешу, а кеш тоді ще потрібен.
 */
export function ClearUserCaches() {
  useEffect(() => {
    if (navigator.onLine) void clearUserDeviceData();
  }, []);
  return null;
}
