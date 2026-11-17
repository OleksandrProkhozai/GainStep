import type { Viewport } from "next";

// viewport-fit=cover — щоб env(safe-area-inset-*) працював на iPhone
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0e0f11",
};

/**
 * "Режим фокусу" для активного тренування: окремо від групи (app),
 * тож без сайдбару й нижньої навігації застосунку.
 */
export default function WorkoutLayout({ children }: LayoutProps<"/workout">) {
  return (
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">{children}</div>
  );
}
