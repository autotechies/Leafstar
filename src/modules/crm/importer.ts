import "server-only";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { normalizeGstin, normalizePhone } from "@/lib/formats";
import { CUSTOMER_TIERS, type CustomerTier } from "./types";

export interface ParsedBuyerRow {
  line: number;
  name: string;
  businessName?: string;
  phone?: string;
  email?: string;
  city?: string;
  gstin?: string;
  creditLimit?: number | null;
  paymentTermsDays?: number | null;
  notes?: string;
  customerTier?: CustomerTier;
  tags?: string[];
  status: "valid" | "warning" | "error";
  message?: string;
}

export interface ParseBuyerFileResult {
  fileName: string;
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  detectedColumns: string[];
  rows: ParsedBuyerRow[];
}

export class FileParseError extends Error {}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((r) => r.text).join("").trim();
    if ("text" in value) return String(value.text).trim();
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

/** Reads 2D rows from Excel workbook (.xlsx), CSV, or TSV buffer */
export async function extractRawSheetRows(buffer: Buffer, fileName: string): Promise<string[][]> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".xls") && !lower.endsWith(".xlsx")) {
    throw new FileParseError(
      "This file is in the older binary .xls format. Please open it in Microsoft Excel, Google Sheets, or LibreOffice, save or export it as .xlsx or .csv, and upload again.",
    );
  }

  const workbook = new ExcelJS.Workbook();
  const rawRows: string[][] = [];

  try {
    if (lower.endsWith(".csv")) {
      const sheet = await workbook.csv.read(Readable.from(buffer));
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const values: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          values.push(cellText(cell.value));
        });
        if (values.some((v) => v.length > 0)) {
          rawRows.push(values);
        }
      });
    } else if (lower.endsWith(".tsv") || lower.endsWith(".txt")) {
      const text = buffer.toString("utf-8");
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      for (const line of lines) {
        const delimiter = line.includes("\t") ? "\t" : line.includes(",") ? "," : ";";
        const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ""));
        if (parts.some((p) => p.length > 0)) {
          rawRows.push(parts);
        }
      }
    } else {
      // Default to .xlsx
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new FileParseError("The uploaded Excel workbook contains no worksheets.");

      sheet.eachRow({ includeEmpty: false }, (row) => {
        const values: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          values.push(cellText(cell.value));
        });
        if (values.some((v) => v.length > 0)) {
          rawRows.push(values);
        }
      });
    }
  } catch (err) {
    if (err instanceof FileParseError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new FileParseError(`Could not read file: ${msg}`);
  }

  return rawRows;
}

interface ColumnIndices {
  name: number;
  businessName: number;
  phone: number;
  email: number;
  city: number;
  gstin: number;
  creditLimit: number;
  paymentTermsDays: number;
  notes: number;
  tier: number;
  tags: number;
}

function detectColumnMapping(headerRow: string[]): { indices: ColumnIndices; hasHeader: boolean } {
  const norm = headerRow.map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ""));

  const findIdx = (keywords: string[]) =>
    norm.findIndex((col) => keywords.some((kw) => col.includes(kw)));

  const nameIdx = findIdx(["name", "buyer", "customer", "party", "client"]);
  const businessIdx = findIdx(["business", "company", "firm", "shop", "store", "enterprise", "agency"]);
  const phoneIdx = findIdx(["phone", "mobile", "contact", "whatsapp", "tel", "cell"]);
  const emailIdx = findIdx(["email", "mail"]);
  const cityIdx = findIdx(["city", "location", "place", "town", "district", "state"]);
  const gstinIdx = findIdx(["gstin", "gst", "tax"]);
  const creditIdx = findIdx(["credit", "creditlimit", "limit"]);
  const termsIdx = findIdx(["terms", "days", "paymentterms", "creditdays", "due"]);
  const notesIdx = findIdx(["note", "notes", "remark", "remarks", "comment", "address"]);
  const tierIdx = findIdx(["tier", "customertier", "category", "segment", "grade"]);
  const tagsIdx = findIdx(["tags", "tag", "label", "labels"]);

  const hasHeader = nameIdx !== -1 || phoneIdx !== -1 || businessIdx !== -1 || gstinIdx !== -1;

  if (hasHeader) {
    return {
      hasHeader: true,
      indices: {
        name: nameIdx !== -1 ? nameIdx : 0,
        businessName: businessIdx,
        phone: phoneIdx,
        email: emailIdx,
        city: cityIdx,
        gstin: gstinIdx,
        creditLimit: creditIdx,
        paymentTermsDays: termsIdx,
        notes: notesIdx,
        tier: tierIdx,
        tags: tagsIdx,
      },
    };
  }

  // Fallback positional indexing if no headers detected
  return {
    hasHeader: false,
    indices: {
      name: 0,
      businessName: 1,
      phone: 2,
      city: 3,
      gstin: 4,
      creditLimit: 5,
      paymentTermsDays: 6,
      notes: 7,
      email: -1,
      tier: -1,
      tags: -1,
    },
  };
}

/** Parses raw 2D sheet rows into validated customer records */
export function processRawBuyerRows(rawRows: string[][], fileName: string): ParseBuyerFileResult {
  if (rawRows.length === 0) {
    return {
      fileName,
      totalRows: 0,
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
      detectedColumns: [],
      rows: [],
    };
  }

  const { indices, hasHeader } = detectColumnMapping(rawRows[0]);
  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const detectedColumns = hasHeader ? rawRows[0] : ["Column 1", "Column 2", "Column 3", "Column 4"];

  const parsed: ParsedBuyerRow[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const lineNum = hasHeader ? i + 2 : i + 1;

    const rawName = indices.name >= 0 ? r[indices.name]?.trim() : "";
    const rawBusiness = indices.businessName >= 0 ? r[indices.businessName]?.trim() : "";
    const rawPhone = indices.phone >= 0 ? r[indices.phone]?.trim() : "";
    const rawEmail = indices.email >= 0 ? r[indices.email]?.trim() : "";
    const rawCity = indices.city >= 0 ? r[indices.city]?.trim() : "";
    const rawGstin = indices.gstin >= 0 ? r[indices.gstin]?.trim() : "";
    const rawCredit = indices.creditLimit >= 0 ? r[indices.creditLimit]?.trim() : "";
    const rawTerms = indices.paymentTermsDays >= 0 ? r[indices.paymentTermsDays]?.trim() : "";
    const rawNotes = indices.notes >= 0 ? r[indices.notes]?.trim() : "";
    const rawTier = indices.tier >= 0 ? r[indices.tier]?.trim().toLowerCase().replace(/[\s-]/g, "_") : "";
    const rawTags = indices.tags >= 0 ? r[indices.tags]?.trim() : "";

    // Skip empty lines
    if (!rawName && !rawBusiness && !rawPhone) continue;

    // Validation
    const name = rawName || rawBusiness;
    if (!name) {
      parsed.push({
        line: lineNum,
        name: "",
        businessName: rawBusiness || undefined,
        status: "error",
        message: "Missing buyer or business name.",
      });
      errorCount++;
      continue;
    }

    let phone: string | undefined;
    let phoneWarning = false;
    if (rawPhone) {
      const norm = normalizePhone(rawPhone);
      if (norm) {
        phone = norm;
      } else {
        phoneWarning = true;
      }
    }

    let gstin: string | undefined;
    let gstinWarning = false;
    if (rawGstin) {
      const norm = normalizeGstin(rawGstin);
      if (norm) {
        gstin = norm;
      } else {
        gstinWarning = true;
      }
    }

    let creditLimit: number | null = null;
    if (rawCredit) {
      const num = Number(rawCredit.replace(/[^\d.]/g, ""));
      if (Number.isFinite(num) && num >= 0) creditLimit = num;
    }

    let paymentTermsDays: number | null = null;
    if (rawTerms) {
      const num = Number(rawTerms.replace(/\D/g, ""));
      if (Number.isFinite(num) && num >= 0 && num <= 365) paymentTermsDays = num;
    }

    let customerTier: CustomerTier | undefined;
    if (rawTier && (CUSTOMER_TIERS as readonly string[]).includes(rawTier)) {
      customerTier = rawTier as CustomerTier;
    }

    const tags = rawTags
      ? rawTags
          .split(/[,;|]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    let email: string | undefined;
    if (rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      email = rawEmail.toLowerCase();
    }

    const warnings: string[] = [];
    if (!phone) warnings.push("No phone number");
    if (phoneWarning) warnings.push("Invalid phone format");
    if (gstinWarning) warnings.push("Invalid GSTIN format");

    const status: ParsedBuyerRow["status"] = warnings.length > 0 ? "warning" : "valid";
    if (status === "valid") validCount++;
    else warningCount++;

    parsed.push({
      line: lineNum,
      name,
      businessName: rawBusiness || undefined,
      phone,
      email,
      city: rawCity || undefined,
      gstin,
      creditLimit,
      paymentTermsDays,
      notes: rawNotes || undefined,
      customerTier,
      tags,
      status,
      message: warnings.length > 0 ? warnings.join(" · ") : undefined,
    });
  }

  return {
    fileName,
    totalRows: parsed.length,
    validCount,
    warningCount,
    errorCount,
    detectedColumns,
    rows: parsed,
  };
}
