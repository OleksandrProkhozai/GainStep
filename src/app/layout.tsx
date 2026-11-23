import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { DisableZoom } from "@/components/disable-zoom";
import { LocaleSync } from "@/components/i18n/locale-sync";
import { OfflineSync } from "@/components/pwa/offline-sync";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { DEFAULT_LOCALE, LOCALE_COOKIE } from "@/i18n/config";
import { EARLY_INSTALL_SCRIPT } from "@/lib/pwa/install-mode";
import "./globals.css";

// Кирилиця обов'язкова: інакше українські рядки відмалює системний шрифт.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

/** Шрифт для заголовків і логотипа. */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["700", "800"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.meta");
  return {
    title: { default: "GainStep", template: "%s · GainStep" },
    description: t("description"),
    applicationName: "GainStep",
    // manifest.webmanifest і favicon.ico Next підключає сам (app/manifest.ts, app/favicon.ico).
    icons: {
      icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
      apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    },
    // Запуск з екрана "Додому" на iPhone: без рядка Safari, статус-бар
    // поверх контенту (відступи — env(safe-area-inset-*)).
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "GainStep" },
    formatDetection: { telephone: false },
  };
}

/**
 * Масштабування сторінки на телефонах вимкнене. iOS Safari userScalable
 * ігнорує, тому додатково працюють <DisableZoom /> і touch-action / 16px
 * у globals.css. viewport-fit=cover — щоб env(safe-area-inset-*) працював
 * на iPhone.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0E0F11",
};

/**
 * <html lang> залежить від cookie, а читання cookie в кореневому layout
 * зробило б увесь застосунок request-bound. Тому (за порадою Next для
 * Cache Components) lang ставить inline-скрипт до першого малювання;
 * LocaleSync після гідратації вирівнює lang і cookie з мовою профілю.
 */
const LANG_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=(en|uk)(?:;|$)/);if(m)document.documentElement.lang=m[1]}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${inter.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: EARLY_INSTALL_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <DisableZoom />
        <ServiceWorkerRegister />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {/* Мова — з профілю / cookie / Accept-Language, тобто з запиту.
              Усе, що перекладається, рендериться під цією межею. */}
          <Suspense>
            <IntlProvider>{children}</IntlProvider>
          </Suspense>
          {/* На iPhone тост не має ховатися під статус-бар / Dynamic Island */}
          <Toaster
            richColors
            position="top-center"
            mobileOffset={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

async function IntlProvider({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <NextIntlClientProvider>
      <LocaleSync locale={locale} />
      <OfflineSync />
      {children}
    </NextIntlClientProvider>
  );
}
