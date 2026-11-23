import { USER_CACHES } from "@/lib/pwa/cache-names";
import { offlineStore } from "./offline-store";

/**
 * Вихід з акаунта: прибрати з пристрою дані цього користувача — кешовані
 * сторінки й відповіді Supabase та кеш програми. Черга завершень лишається:
 * тренування, яке ще не дійшло до сервера, не губимо (відправиться після входу).
 */
export async function clearUserDeviceData() {
  offlineStore.getState().setKit(null);
  try {
    await Promise.all(USER_CACHES.map((name) => caches.delete(name)));
  } catch {
    // Cache API недоступний (http без localhost) — кешів і немає
  }
}
