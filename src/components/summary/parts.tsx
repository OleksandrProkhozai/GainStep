import type { CSSProperties, ReactNode } from "react";
import { Check, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Картка в стилі екрана тренування. */
export function Card({
  className,
  children,
  ...props
}: { className?: string; children: ReactNode } & React.ComponentProps<"section">) {
  return (
    <section className={cn("rounded-2xl border border-white/10 bg-card p-4 lg:p-5", className)} {...props}>
      {children}
    </section>
  );
}

/** Заголовок картки з іконкою. */
export function CardTitle({
  icon,
  children,
  id,
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h2 id={id} className={cn("flex items-center gap-2.5 font-heading text-lg font-bold", className)}>
      {icon}
      {children}
    </h2>
  );
}

export const pill =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98]";

// ───────────── Герой: кубок з променями / галочка ─────────────

/** Промені навколо кубка (без верхнього центрального). */
const RAY_ANGLES = [-155, -125, -55, -25, 180, 0, 155, 25];

export function TrophyBurst() {
  return (
    <div className="relative mx-auto flex size-28 items-center justify-center motion-safe:animate-summary-pop lg:size-32">
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full text-amber-400" aria-hidden>
        {RAY_ANGLES.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const p = (r: number) => [60 + r * Math.cos(rad), 60 + r * Math.sin(rad)].map((v) => v.toFixed(2));
          const [x1, y1] = p(44);
          const [x2, y2] = p(56);
          return (
            <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
          );
        })}
      </svg>
      <Trophy
        className="size-16 text-amber-400 drop-shadow-[0_0_22px_rgb(251_191_36/0.45)] lg:size-[72px]"
        strokeWidth={1.75}
        aria-hidden
      />
    </div>
  );
}

export function DoneBadge() {
  return (
    <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_40px_rgb(198_244_50/0.25)] motion-safe:animate-summary-pop lg:size-28">
      <Check className="size-12 lg:size-14" strokeWidth={3} aria-hidden />
    </div>
  );
}

// ───────────── Конфеті (лише CSS, лише при рекорді) ─────────────

const CONFETTI: { x: number; y: number; r: number; color: string; delay: number; round?: boolean }[] = [
  { x: -150, y: -40, r: 260, color: "bg-primary", delay: 0 },
  { x: -120, y: 60, r: -200, color: "bg-amber-400", delay: 60, round: true },
  { x: -95, y: -85, r: 320, color: "bg-orange-400", delay: 120 },
  { x: -60, y: 95, r: 180, color: "bg-sky-400", delay: 40 },
  { x: -40, y: -105, r: -280, color: "bg-white", delay: 160, round: true },
  { x: 40, y: -110, r: 240, color: "bg-primary", delay: 90 },
  { x: 70, y: 90, r: -300, color: "bg-amber-300", delay: 20 },
  { x: 100, y: -75, r: 200, color: "bg-sky-400", delay: 140, round: true },
  { x: 130, y: 45, r: -240, color: "bg-orange-400", delay: 70 },
  { x: 155, y: -30, r: 300, color: "bg-white", delay: 110 },
  { x: -170, y: 15, r: -160, color: "bg-amber-400", delay: 180 },
  { x: 175, y: 10, r: 220, color: "bg-primary", delay: 30, round: true },
];

export function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute top-[34%] left-1/2 hidden motion-safe:block">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          style={
            {
              "--confetti-x": `${c.x}px`,
              "--confetti-y": `${c.y}px`,
              "--confetti-r": `${c.r}deg`,
              animationDelay: `${c.delay + 150}ms`,
            } as CSSProperties
          }
          className={cn(
            "absolute block animate-confetti opacity-0",
            c.round ? "size-2 rounded-full" : "h-1.5 w-2.5 rounded-[2px]",
            c.color,
          )}
        />
      ))}
    </div>
  );
}
