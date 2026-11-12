import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "GainStep",
  description: "Track every lift. Progress automatically.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uk"
      className={`${inter.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
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
