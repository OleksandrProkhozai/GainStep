import Image from "next/image";
import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

const LIME = "198 244 50";

/**
 * Каркас сторінок авторизації.
 * Мобільний (<768px): hero-фото зверху, картка форми заходить на нього.
 * Десктоп (≥768px): дві колонки — фото з логотипом ліворуч, форма праворуч.
 * Висота картки фіксована, тож помилки валідації не розтягують її і фото;
 * якщо форма не влазить — прокручується лише права колонка.
 * Клас `dark` примусово вмикає темні токени для всього піддерева.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="dark relative flex min-h-dvh flex-1 flex-col overflow-x-clip bg-[#0e0f11] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] text-foreground md:items-center md:justify-center md:px-6 md:py-10">
      {/* Смуги в нижньому правому куті екрана — лише мобільний */}
      <DiagonalStripes corner="bottom-right" className="md:hidden" />

      <div className="relative flex w-full flex-1 flex-col md:grid md:h-[min(680px,calc(100dvh-5rem))] md:max-w-5xl md:flex-none md:grid-cols-2 md:overflow-hidden md:rounded-3xl md:border md:border-white/10 md:bg-[#131417] md:shadow-2xl md:shadow-black/40">
        <Hero />

        <section className="relative z-10 -mt-10 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:mt-0 md:flex md:flex-col md:overflow-y-auto md:px-12 md:py-8">
          <div className="mx-auto w-full max-w-md md:my-auto rounded-[24px] border border-white/10 bg-[#16171a]/70 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl md:max-w-sm md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function Hero() {
  return (
    <aside className="relative flex h-[38svh] min-h-[260px] flex-col justify-center overflow-hidden px-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-14 md:h-auto md:min-h-0 md:px-12 md:py-14">
      <Image
        src="/images/login-hero.jpg"
        alt=""
        fill
        preload
        sizes="(min-width: 1024px) 512px, (min-width: 768px) 50vw, 100vw"
        className="pointer-events-none object-cover object-[72%_center] brightness-110 contrast-110 grayscale"
      />
      {/* Знизу фото плавно переходить у фон сторінки */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent via-[#0e0f11]/60 to-[#0e0f11] md:to-[#131417]"
      />
      {/* Ліве затемнення, щоб читався логотип і слоган */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-2/3 bg-linear-to-r from-[#0e0f11]/75 to-transparent"
      />

      <DiagonalStripes corner="top-left" />
      <DiagonalStripes corner="bottom-right" className="hidden md:block" />

      <div className="relative">
        <Dumbbell
          className="size-11 rotate-45 text-[#c6f432] md:size-14"
          strokeWidth={2.25}
          aria-hidden
        />
        <p className="mt-3 font-heading text-4xl leading-none font-extrabold tracking-tight md:mt-4 md:text-[44px] lg:text-5xl">
          <span className="text-white">Gain</span>
          <span className="text-[#c6f432]">Step</span>
        </p>
        <p className="mt-3 text-sm leading-snug text-white/70 md:mt-4 md:text-base lg:text-lg">
          Track every lift.
          <br />
          Progress automatically.
        </p>
      </div>
    </aside>
  );
}

/** Заголовок форми: `accent` — лаймове слово в кінці. */
export function AuthHeader({
  title,
  accent,
  subtitle,
}: {
  title: string;
  accent?: string;
  subtitle: React.ReactNode;
}) {
  return (
    <header className="mb-5 md:mb-7">
      <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-tight text-white md:text-[32px]">
        {title}
        {accent && (
          <>
            {" "}
            <span className="text-[#c6f432]">{accent}</span>
          </>
        )}
      </h1>
      <p className="mt-1 text-sm text-white/55 md:mt-2 md:text-[15px]">
        {subtitle}
      </p>
    </header>
  );
}

/** Три діагональні лаймові смуги в куті (лише CSS). */
function DiagonalStripes({
  corner,
  className,
}: {
  corner: "top-left" | "bottom-right";
  className?: string;
}) {
  const angle = corner === "top-left" ? "135deg" : "315deg";
  const lime = (alpha: number) => `rgb(${LIME} / ${alpha})`;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute size-36",
        corner === "top-left" ? "top-0 left-0" : "right-0 bottom-0",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(${angle},
          transparent 0 14%,
          ${lime(0.35)} 14% 22%,
          transparent 22% 30%,
          ${lime(0.22)} 30% 35%,
          transparent 35% 42%,
          ${lime(0.12)} 42% 45%,
          transparent 45%)`,
      }}
    />
  );
}
