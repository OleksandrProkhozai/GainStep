import ExcelJS from "exceljs";
import { columnWidths, DATE_COLUMNS, type ExportSheets, type Row } from "./export";

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Рядки експорту → файл .xlsx: жирні заголовки, закріплений перший рядок,
 * ширина колонок за вмістом, формат дат мовою інтерфейсу.
 */
export async function buildWorkbook(
  sheets: ExportSheets,
  names: { workouts: string; sets: string; records: string },
  locale: string,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GainStep";
  workbook.created = new Date();
  const dateFormat = locale === "uk" ? "dd.mm.yyyy hh:mm" : "dd mmm yyyy hh:mm";

  const addSheet = (name: string, rows: Row[], dateColumns: readonly number[]) => {
    const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    columnWidths(rows).forEach((width, i) => {
      sheet.getColumn(i + 1).width = width;
    });
    for (const col of dateColumns) sheet.getColumn(col + 1).numFmt = dateFormat;
  };
  addSheet(names.workouts, sheets.workouts, DATE_COLUMNS.workouts);
  addSheet(names.sets, sheets.sets, DATE_COLUMNS.sets);
  addSheet(names.records, sheets.records, DATE_COLUMNS.records);

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}
