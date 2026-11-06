import "server-only";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { ARTICLE_CODE, COLOUR_PRESETS, GARMENTS, SIZE_OPTIONS } from "./constants";

/*
  Excel / CSV stock import (Step 4). One row = one article × colour × size with a piece count.
  Everything is checked row by row BEFORE anything is saved; the owner fixes the file and uploads again.
  Colour code and hex are optional for the common colours listed in constants.ts.
*/

export const TEMPLATE_HEADERS = ["Article code", "Article name", "Type", "Brand", "Fabric", "Pattern", "Colour", "Colour code", "Colour hex", "Size", "Pieces"] as const;
const REQUIRED = new Set(["Article code", "Article name", "Type", "Brand", "Colour", "Size", "Pieces"]);
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export interface ImportRow {
  line: number;
  code: string;
  name: string;
  garment: string;
  category: string;
  brandId: string;
  brandName: string;
  fabric: string | null;
  pattern: string | null;
  colourName: string;
  colourCode: string;
  colourHex: string;
  size: string;
  pieces: number;
}
export interface ImportProblem {
  line: number;
  message: string;
}
export interface ImportCheck {
  rows: ImportRow[];
  problems: ImportProblem[];
  summary: { articles: number; colours: number; pieces: number };
}

export class UnreadableSheetError extends Error {}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((r) => r.text).join("").trim();
    if ("text" in value) return String(value.text).trim();
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim();
}

async function readSheetRows(buffer: Buffer, fileName: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    if (/\.csv$/i.test(fileName)) {
      const sheet = await workbook.csv.read(Readable.from(buffer));
      return collect(sheet);
    }
    if (/\.xls$/i.test(fileName)) throw new UnreadableSheetError("Old .xls files cannot be read. Open it in Excel, choose Save As → .xlsx, and upload that.");
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch (error) {
    if (error instanceof UnreadableSheetError) throw error;
    throw new UnreadableSheetError("This file could not be read. Use the template: .xlsx or .csv.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new UnreadableSheetError("The file has no sheets.");
  return collect(sheet);
}

function collect(sheet: ExcelJS.Worksheet): string[][] {
  const out: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= TEMPLATE_HEADERS.length; c++) cells.push(cellText(row.getCell(c).value));
    out.push(cells);
  });
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const headerIndex = new Map(TEMPLATE_HEADERS.map((h, i) => [norm(h), i]));

export async function checkImport(buffer: Buffer, fileName: string, brands: Array<{ id: string; name: string }>): Promise<ImportCheck> {
  if (buffer.length > MAX_IMPORT_BYTES) throw new UnreadableSheetError("The file is larger than 5 MB.");
  const sheetRows = await readSheetRows(buffer, fileName);
  if (sheetRows.length === 0) throw new UnreadableSheetError("The file is empty.");

  const head = sheetRows[0].map(norm);
  const missing = TEMPLATE_HEADERS.filter((h) => REQUIRED.has(h) && head[headerIndex.get(norm(h))!] !== norm(h));
  if (missing.length) {
    throw new UnreadableSheetError(`The first row must be the headings from the template. Missing or misplaced: ${missing.join(", ")}.`);
  }
  const body = sheetRows.slice(1).map((cells, i) => ({ cells, line: i + 2 })).filter((r) => r.cells.some((c) => c !== ""));
  if (body.length === 0) throw new UnreadableSheetError("There are no stock rows under the headings.");
  if (body.length > MAX_IMPORT_ROWS) throw new UnreadableSheetError(`Too many rows (${body.length}). Import at most ${MAX_IMPORT_ROWS} at a time.`);

  const brandByName = new Map(brands.map((b) => [b.name.toLowerCase(), b]));
  const rows: ImportRow[] = [];
  const problems: ImportProblem[] = [];
  const seen = new Map<string, number>();
  const articleShape = new Map<string, string>(); // code → "garment|brand" for consistency

  for (const { cells, line } of body) {
    const [codeRaw, name, type, brandRaw, fabric, pattern, colour, colourCodeRaw, colourHexRaw, sizeRaw, piecesRaw] = cells;
    const fail = (message: string) => problems.push({ line, message });
    const before = problems.length;

    const code = codeRaw.toUpperCase().replace(/\s+/g, "");
    if (!ARTICLE_CODE.test(code)) fail(`Article code "${codeRaw}" is not in the format LS-SH-0101 or LS-PN-0101.`);
    if (name.length < 2) fail("Article name is missing.");
    const garment = GARMENTS.find((g) => g.value.toLowerCase() === type.toLowerCase());
    if (!garment) fail(`Type "${type}" must be Shirt or Pant.`);
    else if (ARTICLE_CODE.test(code) && !code.startsWith(`LS-${garment.typeCode}-`)) fail(`A ${garment.value.toLowerCase()} code must start with LS-${garment.typeCode}-.`);
    const brand = brandByName.get(brandRaw.toLowerCase());
    if (!brand) fail(`Brand "${brandRaw}" is not in Settings → Brands. Add it there first.`);

    const preset = COLOUR_PRESETS.find((p) => p.name.toLowerCase() === colour.toLowerCase());
    if (!colour) fail("Colour is missing.");
    const colourCode = (colourCodeRaw || preset?.code || "").toUpperCase();
    if (colour && !/^[A-Z]{3}$/.test(colourCode)) fail(`Colour "${colour}" needs a 3-letter code in the "Colour code" column.`);
    const colourHex = colourHexRaw || preset?.hex || "";
    if (colour && !/^#[0-9A-Fa-f]{6}$/.test(colourHex)) fail(`Colour "${colour}" needs a shade written like #RRGGBB in the "Colour hex" column.`);

    const size = sizeRaw.toUpperCase();
    if (!(SIZE_OPTIONS as readonly string[]).includes(size)) fail(`Size "${sizeRaw}" must be one of ${SIZE_OPTIONS.join(", ")}.`);
    const pieces = Number(piecesRaw.replace(/,/g, ""));
    if (piecesRaw === "" || !Number.isInteger(pieces) || pieces < 0) fail(`Pieces "${piecesRaw}" must be a whole number, 0 or more.`);
    else if (pieces > 1_000_000) fail("Pieces is unrealistically large.");

    if (problems.length === before && garment && brand) {
      const shape = `${garment.value}|${brand.id}`;
      const previous = articleShape.get(code);
      if (previous && previous !== shape) fail(`Article ${code} appears with a different type or brand on another row.`);
      articleShape.set(code, shape);
      const key = `${code}|${colourCode}|${size}`;
      const first = seen.get(key);
      if (first) fail(`Same article, colour and size as row ${first}. Combine them into one row.`);
      seen.set(key, line);
    }

    if (problems.length === before && garment && brand) {
      rows.push({
        line, code, name, garment: garment.value, category: garment.category, brandId: brand.id, brandName: brand.name,
        fabric: fabric || null, pattern: pattern || null, colourName: colour, colourCode, colourHex: colourHex.toUpperCase(), size, pieces,
      });
    }
  }

  const articles = new Set(rows.map((r) => r.code));
  const colours = new Set(rows.map((r) => `${r.code}|${r.colourCode}`));
  return { rows, problems, summary: { articles: articles.size, colours: colours.size, pieces: rows.reduce((s, r) => s + r.pieces, 0) } };
}

/** Groups checked rows into the shape the import_stock database function takes. */
export function toImportPayload(rows: ImportRow[], batch: { code: string; producedOn: string; notes: string }) {
  const articles = new Map<string, { code: string; name: string; category: string; garment: string; brand_id: string; fabric: string | null; pattern: string | null; colors: Map<string, { name: string; code: string; hex: string; stock: Record<string, number> }> }>();
  for (const r of rows) {
    let a = articles.get(r.code);
    if (!a) {
      a = { code: r.code, name: r.name, category: r.category, garment: r.garment, brand_id: r.brandId, fabric: r.fabric, pattern: r.pattern, colors: new Map() };
      articles.set(r.code, a);
    }
    let c = a.colors.get(r.colourCode);
    if (!c) {
      c = { name: r.colourName, code: r.colourCode, hex: r.colourHex, stock: {} };
      a.colors.set(r.colourCode, c);
    }
    c.stock[r.size] = r.pieces;
  }
  return {
    batch: { code: batch.code, produced_on: batch.producedOn, notes: batch.notes },
    articles: [...articles.values()].map((a) => ({ ...a, colors: [...a.colors.values()] })),
  };
}

export async function buildTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Stock");
  sheet.addRow([...TEMPLATE_HEADERS]);
  sheet.addRow(["LS-SH-0101", "Check Shirt", "Shirt", "Leaf Star", "Cotton", "Checks", "Navy", "", "", "M", 60]);
  sheet.addRow(["LS-SH-0101", "Check Shirt", "Shirt", "Leaf Star", "Cotton", "Checks", "Navy", "", "", "L", 80]);
  sheet.addRow(["LS-PN-0201", "Cargo Pant", "Pant", "Leaf Star", "Twill", "Solid", "Olive", "", "", "L", 40]);
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8DFC8" } };
  sheet.columns = TEMPLATE_HEADERS.map((h) => ({ width: Math.max(14, h.length + 4) }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const notes = workbook.addWorksheet("How to fill");
  for (const line of [
    "One row = one article, one colour, one size.",
    "Delete the three example rows, then paste your stock under the headings. Keep the headings exactly as they are.",
    "Article code: LS-SH-0101 for a shirt, LS-PN-0101 for a pant.",
    "Type: Shirt or Pant.  Brand: must already exist in Settings → Brands.",
    `Size: ${SIZE_OPTIONS.join(", ")}.  Pieces: whole numbers.`,
    `Colour: ${COLOUR_PRESETS.map((c) => c.name).join(", ")} need no code or hex. For any other colour fill "Colour code" (3 letters) and "Colour hex" (written like #RRGGBB).`,
    "Importing adds pieces. It never replaces what you already have. Articles are created hidden until you add photos.",
    "Nothing is saved until every row is correct. Errors are listed by row number.",
  ]) notes.addRow([line]);
  notes.getColumn(1).width = 120;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
