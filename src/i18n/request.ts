import { getRequestConfig } from "next-intl/server";
import { USER_TIME_ZONE } from "@/lib/dates";
import { getRequestLocale } from "./locale";

/**
 * next-intl без локалі в URL: мова визначається для кожного запиту
 * (профіль > cookie > Accept-Language). Через cookies() усі переклади
 * рендеряться в межах <Suspense> (див. кореневий layout) — static shell
 * не містить мовного тексту і не може "протекти" між користувачами.
 */
export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: USER_TIME_ZONE,
  };
});
