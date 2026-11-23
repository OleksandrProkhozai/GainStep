import ExcelJS from "exceljs";
import { muscleStyle } from "@/lib/exercises/muscles";
import { COLUMNS, columnWidths, DATE_COLUMNS, SHEET_ORDER, type Cell, type ExportSheets, type Row, type SheetKey } from "./export";

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Палітра файлу — кольори GainStep, підібрані під білий фон Excel
 * (ARGB, як їх пише exceljs). Лайм — лише акценти: рамки, data bar, рекорди.
 */
export const XLSX_COLORS = {
  headerFill: "FF0E0F11",
  headerText: "FFFFFFFF",
  lime: "FFC6F432",
  blockA: "FFFFFFFF",
  blockB: "FFF4F6F0",
  record: "FFEAF8C4",
  deloadFill: "FFFFE7CC",
  deloadText: "FFB35C00",
  muted: "FFA0A0A0",
  recordsStripe: "FFFFF6D6",
  gainUp: "FF2E7D32",
  gainZero: "FF8A8F98",
  gainDown: "FFB35C00",
  totalBorder: "FF0E0F11",
} as const;

export const TAB_COLORS: Record<SheetKey, string> = {
  journal: "FFC6F432",
  workouts: "FF8A8F98",
  records: "FFF5C542",
  exercises: "FF64B5F6",
};

const FONT = { name: "Calibri", size: 11, family: 2 } as const;
/** Приріст: "▲ 5,0" / "▼ 2,5" / "0" — число лишається числом. */
export const GAIN_FORMAT = '"▲ "0.0;"▼ "0.0;0';

const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** "#FF8A65" → світлий відтінок (20% кольору на білому), ARGB. */
export function tint(hex: string, amount = 0.2): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const mix = (c: number) => Math.round(c * amount + 255 * (1 - amount));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `FF${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Числа й дати — праворуч, текст — ліворуч. */
const alignFor = (value: Cell): Partial<ExcelJS.Alignment> => ({
  vertical: "middle",
  horizontal: typeof value === "number" || value instanceof Date ? "right" : "left",
});

/** A1-адреса колонки за індексом з 0 ("A", "B", …). */
const col = (i: number) => {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Діапазон даних колонки (рядки 2…last), напр. "I2:I40". */
const dataRange = (i: number, lastRow: number) => `${col(i)}2:${col(i)}${lastRow}`;

const dataBar = (ref: string, priority: number): ExcelJS.ConditionalFormattingOptions => ({
  ref,
  rules: [
    {
      type: "dataBar",
      priority,
      // gradient: false → exceljs пише, як сам Excel: класичний <dataBar>
      // (Excel 2007, LibreOffice) + x14-розширення з тим самим id (суцільна
      // заливка в Excel 2010+). З gradient: true exceljs лишає порожній
      // <x14:id/>, що посилається в нікуди.
      gradient: false,
      cfvo: [{ type: "min" }, { type: "max" }],
      color: { argb: XLSX_COLORS.lime },
    } as ExcelJS.DataBarRuleType & { color: Partial<ExcelJS.Color> },
  ],
});

/**
 * Рядки експорту → файл .xlsx. Аркуші — у порядку SHEET_ORDER (перший —
 * журнал підходів, на ньому Excel і відкривається), з кольоровими вкладками.
 * Скрізь: темний рядок заголовків з лаймовою рамкою, автофільтр і
 * закріплення від 1-го рядка, Calibri 11, числа праворуч, текст ліворуч.
 * Далі — оформлення кожного аркуша (див. style* нижче).
 */
export async function buildWorkbook(
  sheets: ExportSheets,
  names: Record<SheetKey, string>,
  locale: string,
  text: { total: string },
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GainStep";
  workbook.created = new Date();
  const dateTimeFormat = locale === "uk" ? "dd.mm.yyyy hh:mm" : "dd mmm yyyy hh:mm";
  const dateOnlyFormat = locale === "uk" ? "dd.mm.yyyy" : "dd mmm yyyy";

  for (const key of SHEET_ORDER) {
    const rows = sheets[key];
    const sheet = workbook.addWorksheet(names[key], {
      views: [{ state: "frozen", ySplit: 1 }],
      properties: { tabColor: { argb: TAB_COLORS[key] } },
    });
    sheet.addRows(rows);
    const columns = rows[0]?.length ?? 0;

    // Базовий стиль комірок даних.
    for (let r = 2; r <= rows.length; r++) {
      const row = sheet.getRow(r);
      rows[r - 1].forEach((value, c) => {
        const cell = row.getCell(c + 1);
        cell.font = { ...FONT };
        cell.alignment = alignFor(value);
      });
    }

    // Автофільтр — заголовок + усі дані (рядок "Разом" нижче — поза ним).
    if (columns > 0) {
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length), column: columns } };
    }
    columnWidths(rows).forEach((width, i) => {
      sheet.getColumn(i + 1).width = width;
    });
    const format = key === "exercises" ? dateOnlyFormat : dateTimeFormat;
    for (const c of DATE_COLUMNS[key]) sheet.getColumn(c + 1).numFmt = format;

    if (key === "journal") styleJournal(sheet, sheets);
    if (key === "workouts") styleWorkouts(sheet, rows, text.total);
    if (key === "records") styleRecords(sheet, rows);
    if (key === "exercises") styleExercises(sheet, rows);

    styleHeader(sheet.getRow(1), columns);
  }

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

function styleHeader(row: ExcelJS.Row, columns: number) {
  row.height = 24;
  for (let c = 1; c <= columns; c++) {
    const cell = row.getCell(c);
    cell.font = { ...FONT, bold: true, color: { argb: XLSX_COLORS.headerText } };
    cell.fill = solid(XLSX_COLORS.headerFill);
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "thick", color: { argb: XLSX_COLORS.lime } } };
  }
}

/**
 * Журнал: тренування — блоками (білий / світло-сіро-зелений), лаймова рамка
 * й жирні дата/день над першим рядком тренування; рекорд — світло-лаймовий
 * рядок, жирні вага й 1ПМ; розвантаження — помаранчева вага; невиконані —
 * сірий курсив; група м'язів — світлий відтінок кольору MuscleTile;
 * тоннаж підходу — лаймовий data bar.
 */
function styleJournal(sheet: ExcelJS.Worksheet, sheets: ExportSheets) {
  const J = COLUMNS.journal;
  const columns = sheets.journal[0]?.length ?? 0;
  sheets.journalStyle.forEach((style, i) => {
    const row = sheet.getRow(i + 2); // +1 — заголовок, +1 — нумерація з 1
    const base = style.pr ? XLSX_COLORS.record : style.shaded ? XLSX_COLORS.blockB : XLSX_COLORS.blockA;
    for (let c = 0; c < columns; c++) {
      const cell = row.getCell(c + 1);
      const bold =
        (style.firstOfWorkout && (c === J.date || c === J.day)) || (style.pr && (c === J.weight || c === J.e1rm));
      let color: string | undefined = style.completed ? undefined : XLSX_COLORS.muted;
      let fillColor: string = base;
      if (c === J.muscle) fillColor = tint(muscleStyle(style.muscleGroup).color);
      if (c === J.weight && style.deload) {
        fillColor = XLSX_COLORS.deloadFill;
        color = XLSX_COLORS.deloadText;
      }
      cell.font = {
        ...FONT,
        ...(bold ? { bold: true } : {}),
        ...(style.completed ? {} : { italic: true }),
        ...(color ? { color: { argb: color } } : {}),
      };
      cell.fill = solid(fillColor);
      if (style.firstOfWorkout && i > 0) cell.border = { top: { style: "medium", color: { argb: XLSX_COLORS.lime } } };
    }
  });
  const last = sheets.journal.length;
  if (last > 1) sheet.addConditionalFormatting(dataBar(dataRange(J.setVolume, last), 1));
}

/**
 * Тренування: тоннаж — data bar, рекорди > 0 — світло-лаймові й жирні;
 * знизу рядок "Разом" з формулами (SUM підходів/тоннажу/рекордів,
 * AVERAGE тривалості) — щоб після правок у файлі підсумок перераховувався.
 */
function styleWorkouts(sheet: ExcelJS.Worksheet, rows: Row[], totalLabel: string) {
  const W = COLUMNS.workouts;
  const last = rows.length;
  sheet.getColumn(W.duration + 1).numFmt = "[h]:mm";
  sheet.getColumn(W.duration + 1).width = Math.max(12, String(rows[0]?.[W.duration] ?? "").length + 2);

  for (let r = 2; r <= last; r++) {
    const value = rows[r - 1][W.records];
    if (typeof value === "number" && value > 0) {
      const cell = sheet.getRow(r).getCell(W.records + 1);
      cell.fill = solid(XLSX_COLORS.record);
      cell.font = { ...FONT, bold: true };
    }
  }
  if (last < 2) return;

  sheet.addConditionalFormatting(dataBar(dataRange(W.volume, last), 1));

  const data = rows.slice(1);
  const sum = (c: number) => data.reduce<number>((acc, row) => acc + (typeof row[c] === "number" ? (row[c] as number) : 0), 0);
  const durations = data.map((row) => row[W.duration]).filter((v): v is number => typeof v === "number");
  const range = (c: number) => `${col(c)}2:${col(c)}${last}`;

  const total = sheet.getRow(last + 1);
  const columns = rows[0].length;
  const values: Partial<Record<number, ExcelJS.CellValue>> = {
    [W.label]: totalLabel,
    [W.duration]: durations.length
      ? { formula: `AVERAGE(${range(W.duration)})`, result: durations.reduce((a, b) => a + b, 0) / durations.length }
      : null,
    [W.sets]: { formula: `SUM(${range(W.sets)})`, result: sum(W.sets) },
    [W.volume]: { formula: `SUM(${range(W.volume)})`, result: sum(W.volume) },
    [W.records]: { formula: `SUM(${range(W.records)})`, result: sum(W.records) },
  };
  for (let c = 0; c < columns; c++) {
    const cell = total.getCell(c + 1);
    const value = values[c];
    if (value !== undefined) cell.value = value;
    cell.font = { ...FONT, bold: true };
    cell.alignment = { vertical: "middle", horizontal: c === W.label ? "left" : "right" };
    cell.border = { top: { style: "medium", color: { argb: XLSX_COLORS.totalBorder } } };
  }
  total.height = 20;
}

/** Рекорди: світло-золоті рядки через один, 1ПМ жирний. */
function styleRecords(sheet: ExcelJS.Worksheet, rows: Row[]) {
  const columns = rows[0]?.length ?? 0;
  for (let r = 2; r <= rows.length; r++) {
    const row = sheet.getRow(r);
    for (let c = 0; c < columns; c++) {
      const cell = row.getCell(c + 1);
      if (r % 2 === 1) cell.fill = solid(XLSX_COLORS.recordsStripe);
      if (c === COLUMNS.records.e1rm) cell.font = { ...FONT, bold: true };
    }
  }
}

/** Вправи: приріст — ▲ зелений / сірий нуль / ▼ помаранчевий; приріст % — шкала білий → лайм. */
function styleExercises(sheet: ExcelJS.Worksheet, rows: Row[]) {
  const E = COLUMNS.exercises;
  sheet.getColumn(E.gain + 1).numFmt = GAIN_FORMAT;
  for (let r = 2; r <= rows.length; r++) {
    const value = rows[r - 1][E.gain];
    if (typeof value !== "number") continue;
    const color = value > 0 ? XLSX_COLORS.gainUp : value < 0 ? XLSX_COLORS.gainDown : XLSX_COLORS.gainZero;
    sheet.getRow(r).getCell(E.gain + 1).font = { ...FONT, ...(value !== 0 ? { bold: true } : {}), color: { argb: color } };
  }
  if (rows.length < 2) return;
  sheet.addConditionalFormatting({
    ref: dataRange(E.gainPct, rows.length),
    rules: [
      {
        type: "colorScale",
        priority: 1,
        cfvo: [{ type: "min" }, { type: "max" }],
        color: [{ argb: "FFFFFFFF" }, { argb: XLSX_COLORS.lime }],
      },
    ],
  });
}
