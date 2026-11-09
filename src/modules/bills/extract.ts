import "server-only";
import { Readable } from "node:stream";
import type { Part } from "@google/genai";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { generate, type GeminiTransport } from "@/modules/ai/gemini";
import { checkBillFile, type BillKind } from "./formats";
import { BILL_SYSTEM_PROMPT, billJsonSchema, billSchema, type ExtractedBill } from "./schema";

/*
  Reading one bill file (AGENTS.md §10): photos and PDFs go to Gemini as they are; Word and Excel/CSV files have their
  text pulled out first (so the owner can check the raw text too). The answer is checked with zod, and asked for once more
  if it is not valid.
*/

export class UnreadableBillError extends Error {}

const MAX_TEXT = 60_000;

export async function sheetToText(bytes: Buffer, isCsv: boolean): Promise<string> {
  const book = new ExcelJS.Workbook();
  if (isCsv) await book.csv.read(Readable.from(bytes));
  else await book.xlsx.load(bytes as unknown as ArrayBuffer);
  const rows: string[] = [];
  book.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      const cells = (row.values as unknown[]).slice(1).map((c) => (c === null || c === undefined ? "" : typeof c === "object" ? String((c as { result?: unknown; text?: unknown }).result ?? (c as { text?: unknown }).text ?? "") : String(c)));
      if (cells.some((c) => c.trim())) rows.push(cells.join(" | "));
    });
  });
  return rows.join("\n");
}

export async function prepareParts(file: { name: string; type: string; bytes: Buffer }): Promise<{ kind: BillKind; parts: Part[]; text: string | null }> {
  const check = checkBillFile(file.name, file.type, file.bytes.length);
  if (!check.ok || !check.kind || !check.mime) throw new UnreadableBillError(check.error ?? "This file cannot be read.");
  if (check.kind === "image" || check.kind === "pdf") {
    return { kind: check.kind, parts: [{ inlineData: { mimeType: check.mime, data: file.bytes.toString("base64") } }, { text: "Read this bill." }], text: null };
  }
  let text: string;
  try {
    text = check.kind === "docx" ? (await mammoth.extractRawText({ buffer: file.bytes })).value : await sheetToText(file.bytes, check.mime === "text/csv");
  } catch {
    throw new UnreadableBillError("This file could not be opened. It may be damaged or protected.");
  }
  text = text.trim().slice(0, MAX_TEXT);
  if (!text) throw new UnreadableBillError("There is no text in this file.");
  return { kind: check.kind, parts: [{ text: `Here is the text of the bill:\n\n${text}` }], text };
}

export async function extractBill(file: { name: string; type: string; bytes: Buffer }, refId: string, transport?: GeminiTransport): Promise<{ bill: ExtractedBill; rawText: string | null }> {
  const { parts, text } = await prepareParts(file);
  let lastIssue = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generate(
      {
        feature: "bill_scan",
        refId,
        system: BILL_SYSTEM_PROMPT,
        parts: attempt === 0 ? parts : [...parts, { text: `Your previous answer was not valid (${lastIssue}). Answer again as JSON in the required shape.` }],
        jsonSchema: billJsonSchema,
        temperature: 0,
        maxOutputTokens: 8192,
      },
      { transport },
    );
    try {
      const parsed = billSchema.safeParse(JSON.parse(result.text));
      if (parsed.success) {
        // A Product ID printed beside the name is kept with the name, so matching and the review screen both see it.
        const lines = parsed.data.lines.map((l) => {
          const id = l.product_id.trim();
          return id && !`${l.raw_text} ${l.name}`.toUpperCase().includes(id.toUpperCase()) ? { ...l, name: `${id} ${l.name}`.trim() } : l;
        });
        return { bill: { ...parsed.data, lines }, rawText: text };
      }
      lastIssue = parsed.error.issues[0]?.message ?? "wrong shape";
    } catch {
      lastIssue = "not JSON";
    }
  }
  throw new UnreadableBillError("We could not read this bill. You can enter its lines by hand.");
}
