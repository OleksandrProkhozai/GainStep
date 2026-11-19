import type { Locale } from "@/i18n/config";
import type messages from "../messages/en.json";

// Типізовані ключі перекладів: t("dashboard.title") перевіряє tsc.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
