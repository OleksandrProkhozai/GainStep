/**
 * Кольори Recharts. Застосунок має лише темну тему, тож палітра одна.
 * SVG-атрибути не розуміють CSS-змінних надійно в усіх браузерах —
 * тому явні hex-значення.
 */
export interface ChartColors {
  /** Лінія / основна серія. */
  line: string;
  /** Стовпчики й заливка під лінією. */
  fill: string;
  grid: string;
  tick: string;
  /** Фон точок (як фон картки). */
  surface: string;
  /** Deload / попередження. */
  orange: string;
  /** Курсор тултіпа. */
  cursor: string;
}

const DARK: ChartColors = {
  line: "#c6f432",
  fill: "#c6f432",
  grid: "rgb(255 255 255 / 0.06)",
  tick: "#8b8f98",
  surface: "#16171a",
  orange: "#fb923c",
  cursor: "rgb(255 255 255 / 0.15)",
};

export function useChartColors(): ChartColors {
  return DARK;
}
