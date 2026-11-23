"use client";

import { useEffect } from "react";

/** Інтервал між двома тапами, який браузер вважає подвійним тапом. */
const DOUBLE_TAP_MS = 300;

/**
 * Поля вводу й контроли, на яких подвійний тап не гасимо:
 * - у полях подвійний тап виділяє слово / ставить курсор;
 * - на кнопках preventDefault на touchend з'їв би click, і швидкі
 *   тапи по степеру "+" рахувалися б як один. Зум на них уже вимкнено
 *   через touch-action: manipulation у globals.css.
 */
const SKIP_DOUBLE_TAP =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), button, a[href], label, summary, [role='button'], [role='checkbox'], [role='switch'], [role='tab'], [role='option'], [role='menuitem'], [role='slider']";

/**
 * Забороняє масштабування сторінки на телефонах.
 *
 * userScalable: false у viewport iOS Safari ігнорує (з iOS 10, заради
 * доступності), тому дублюємо JS-слухачами:
 * - gesture* — нативні жести масштабування Safari;
 * - touchmove з двома й більше пальцями — pinch;
 * - другий touchend на тому ж елементі за < 300 мс — подвійний тап.
 *
 * Один палець не чіпаємо: звичайний скрол, свайпи, dnd-kit, vaul-drawer
 * і горизонтальні вкладки працюють як раніше.
 */
export function DisableZoom() {
  useEffect(() => {
    const prevent = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault();
    };

    let lastTapAt = 0;
    let lastTarget: EventTarget | null = null;

    const onTouchEnd = (e: TouchEvent) => {
      // Кінець мультитач-жесту не вважаємо тапом.
      if (e.touches.length > 0 || e.changedTouches.length !== 1) {
        lastTapAt = 0;
        lastTarget = null;
        return;
      }

      const now = e.timeStamp || Date.now();
      const target = e.target;
      const isDoubleTap =
        target === lastTarget && now - lastTapAt < DOUBLE_TAP_MS;

      if (isDoubleTap) {
        const skip =
          target instanceof Element && target.closest(SKIP_DOUBLE_TAP);
        if (!skip && e.cancelable) e.preventDefault();
        // Третій тап поспіль — знову "перший".
        lastTapAt = 0;
        lastTarget = null;
        return;
      }

      lastTapAt = now;
      lastTarget = target;
    };

    const active = { passive: false } as const;
    document.addEventListener("gesturestart", prevent, active);
    document.addEventListener("gesturechange", prevent, active);
    document.addEventListener("gestureend", prevent, active);
    document.addEventListener("touchmove", onTouchMove, active);
    document.addEventListener("touchend", onTouchEnd, active);

    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
      document.removeEventListener("gestureend", prevent);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return null;
}
