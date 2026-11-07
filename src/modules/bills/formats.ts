/*
  Which bill files we can read (AGENTS.md §10). Pure and shared by the browser (to refuse early with a clear message)
  and the server (the real check).
*/

export const MAX_BILL_BYTES = 20 * 1024 * 1024;

export type BillKind = "image" | "pdf" | "docx" | "sheet";

export interface BillFileCheck {
  ok: boolean;
  kind?: BillKind;
  mime?: string;
  error?: string;
}

export function checkBillFile(name: string, type: string, size: number): BillFileCheck {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (size <= 0) return { ok: false, error: "This file is empty." };
  if (size > MAX_BILL_BYTES) return { ok: false, error: "This file is larger than 20 MB." };
  if (ext === "doc") return { ok: false, error: "Old .doc files cannot be read. Save it as .docx and upload again." };
  if (ext === "xls") return { ok: false, error: "Old .xls files cannot be read. Save it as .xlsx and upload again." };
  if (["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext) || /^image\/(jpeg|png|webp|heic|heif)$/.test(type)) {
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "heic" || ext === "heif" ? "image/heic" : "image/jpeg";
    return { ok: true, kind: "image", mime };
  }
  if (ext === "pdf" || type === "application/pdf") return { ok: true, kind: "pdf", mime: "application/pdf" };
  if (ext === "docx") return { ok: true, kind: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  if (ext === "xlsx") return { ok: true, kind: "sheet", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  if (ext === "csv" || type === "text/csv") return { ok: true, kind: "sheet", mime: "text/csv" };
  return { ok: false, error: "This file type is not supported. Use a photo, PDF, .docx, .xlsx or .csv." };
}
