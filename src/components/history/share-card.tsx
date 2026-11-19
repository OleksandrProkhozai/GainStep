/**
 * Картинка "Поділитися" (1080×1350) для next/og ImageResponse (Satori):
 * лише flexbox і inline-стилі. Без хуків — рендериться в route handler.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { formatMinutes } from "@/lib/dates";
import type { HistoryWorkout } from "@/lib/history/derive";
import { exerciseName } from "@/lib/i18n/names";
import { epley1RM } from "@/lib/metrics";
import { createWeightFormat, formatNumber, kgToUnit, type WeightUnit } from "@/lib/units";
import { longDateTime } from "./format";

export const SHARE_IMAGE_SIZE = { width: 1080, height: 1350 } as const;
const MAX_EXERCISES = 5;

const HEADING = "Manrope, \"Manrope Cyrillic\"";
const BODY = "Inter, \"Inter Cyrillic\"";

const C = {
  bg: "#0E0F11",
  card: "#16171A",
  border: "#24262B",
  lime: "#C6F432",
  text: "#F2F3F5",
  muted: "#8A8F98",
};

type ShareFont = { name: string; data: ArrayBuffer; weight: 500 | 700 | 800; style: "normal" };

let fontsPromise: Promise<ShareFont[]> | null = null;

/**
 * Шрифти з кирилицею: woff-файли @fontsource (latin + cyrillic) у
 * assets/fonts. Satori не підтримує woff2, тож саме woff. Однакова назва
 * для двох файлів не працює (Satori бере перший, і кирилиця падає в чужий
 * шрифт іншої товщини), тому кирилиця — окрема родина у fallback-списку.
 */
export function loadShareFonts(root = process.cwd()) {
  if (!fontsPromise) {
    const file = (name: string) =>
      readFile(join(root, "assets", "fonts", name)).then(
        (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      );
    const spec = [
      ["Manrope", 800, "manrope-latin-800-normal.woff"],
      ["Manrope Cyrillic", 800, "manrope-cyrillic-800-normal.woff"],
      ["Inter", 500, "inter-latin-500-normal.woff"],
      ["Inter Cyrillic", 500, "inter-cyrillic-500-normal.woff"],
      ["Inter", 700, "inter-latin-700-normal.woff"],
      ["Inter Cyrillic", 700, "inter-cyrillic-700-normal.woff"],
    ] as const;
    fontsPromise = Promise.all(
      spec.map(async ([name, weight, path]) => ({ name, weight, style: "normal" as const, data: await file(path) })),
    );
    fontsPromise.catch(() => {
      fontsPromise = null;
    });
  }
  return fontsPromise;
}

export interface ShareLabels {
  duration: string;
  volume: string;
  sets: string;
  best: string;
  /** "2 нові рекорди". */
  records: (count: number) => string;
}

/** Дані картинки: 3 цифри і до 5 вправ з найкращим підходом (за 1ПМ). */
export function shareCardData(workout: HistoryWorkout, unit: WeightUnit, locale: string, labels: ShareLabels) {
  const fmt = createWeightFormat(unit, locale);
  return {
    name: workout.name,
    date: longDateTime(workout.startedAt, workout.dayKey, locale),
    stats: [
      {
        value: workout.stats.durationMinutes === null ? "—" : formatMinutes(workout.stats.durationMinutes, locale),
        label: labels.duration,
      },
      {
        value: `${formatNumber(Math.round(kgToUnit(workout.stats.volumeKg, unit)), locale)} ${fmt.unitLabel}`,
        label: labels.volume,
      },
      { value: String(workout.stats.setsDone), label: labels.sets },
    ],
    records: workout.prCount > 0 ? labels.records(workout.prCount) : null,
    bestTitle: labels.best,
    best: workout.exercises
      .map((ex) => {
        const done = ex.sets.filter((s) => s.isCompleted);
        if (done.length === 0) return null;
        const top = done.reduce((a, b) => (epley1RM(b.weight, b.reps) > epley1RM(a.weight, a.reps) ? b : a));
        // Власна вага (0 кг) — лише повторення.
        const set = top.weight > 0 ? `${fmt.weight(top.weight)} × ${top.reps}` : `× ${top.reps}`;
        return { name: exerciseName(ex, locale), set, pr: ex.hasPR };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, MAX_EXERCISES),
  };
}

export type ShareCardData = ReturnType<typeof shareCardData>;

function TrophyIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function DumbbellIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
      <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />
    </svg>
  );
}

export function ShareCard({ data }: { data: ShareCardData }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "72px 72px 64px",
        backgroundColor: C.bg,
        backgroundImage: "radial-gradient(circle at 85% 0%, rgba(198,244,50,0.18), rgba(198,244,50,0) 55%)",
        color: C.text,
        fontFamily: BODY,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: C.lime,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <DumbbellIcon size={38} color={C.bg} />
        </div>
        <div style={{ display: "flex", fontFamily: HEADING, fontWeight: 800, fontSize: 40 }}>GainStep</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 72 }}>
        <div style={{ display: "flex", fontFamily: HEADING, fontWeight: 800, fontSize: 88, lineHeight: 1.05 }}>{data.name}</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 34, fontWeight: 500, color: C.muted }}>{data.date}</div>
      </div>

      <div style={{ display: "flex", gap: 20, marginTop: 56 }}>
        {data.stats.map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "28px 30px",
              borderRadius: 32,
              backgroundColor: C.card,
              border: `2px solid ${C.border}`,
            }}
          >
            <div style={{ display: "flex", fontFamily: HEADING, fontWeight: 800, fontSize: 40, whiteSpace: "nowrap" }}>{s.value}</div>
            <div style={{ display: "flex", marginTop: 6, fontSize: 26, fontWeight: 500, color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {data.records && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 28,
            padding: "22px 30px",
            borderRadius: 999,
            backgroundColor: "rgba(198,244,50,0.12)",
            color: C.lime,
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          <TrophyIcon size={38} color={C.lime} />
          {data.records}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: "uppercase" }}>
          {data.bestTitle}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
          {data.best.map((b, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "20px 0",
                borderTop: i === 0 ? "none" : `2px solid ${C.border}`,
              }}
            >
              <div style={{ display: "flex", flex: 1, fontSize: 34, fontWeight: 700, overflow: "hidden" }}>{b.name}</div>
              {b.pr && <TrophyIcon size={32} color={C.lime} />}
              <div style={{ display: "flex", fontSize: 34, fontWeight: 500, color: b.pr ? C.lime : C.text }}>{b.set}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", marginTop: "auto", height: 8, width: 120, borderRadius: 999, backgroundColor: C.lime }} />
    </div>
  );
}
