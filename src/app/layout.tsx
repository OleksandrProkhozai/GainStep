import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSync } from "@/components/i18n/locale-sync";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { DEFAULT_LOCALE, LOCALE_COOKIE } from "@/i18n/config";
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
  };
}

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
      </head>
      <body className="min-h-full flex flex-col">
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
      {children}
    </NextIntlClientProvider>
  );
}
