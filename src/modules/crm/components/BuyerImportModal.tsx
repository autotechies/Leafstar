"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { importBuyersAction, parseBuyerFileAction } from "../actions";
import type { ParsedBuyerRow, ParseBuyerFileResult } from "../importer";
import { CUSTOMER_TIERS, type CustomerTier } from "../types";

export function BuyerImportModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"file" | "paste">("file");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParseBuyerFileResult | null>(null);

  // Paste mode state
  const [rawText, setRawText] = useState("");

  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetState() {
    setSelectedFile(null);
    setParsedResult(null);
    setRawText("");
    setError(null);
    setParsing(false);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleFile(file: File) {
    setError(null);
    setSelectedFile(file);
    setParsing(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await parseBuyerFileAction(formData);
    setParsing(false);

    if (!res.ok) {
      setError(res.error);
      setParsedResult(null);
      return;
    }

    setParsedResult(res.result);
  }

  function handleDrag(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFile(e.dataTransfer.files[0]);
    }
  }

  function parsePastedText(text: string) {
    setRawText(text);
    setError(null);

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setParsedResult(null);
      return;
    }

    let startIndex = 0;
    const firstLineLower = lines[0].toLowerCase();
    if (
      firstLineLower.includes("name") ||
      firstLineLower.includes("buyer") ||
      firstLineLower.includes("phone") ||
      firstLineLower.includes("shop") ||
      firstLineLower.includes("party")
    ) {
      startIndex = 1;
    }

    const rows: ParsedBuyerRow[] = [];
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const delimiter = line.includes("\t") ? "\t" : line.includes(",") ? "," : ";";
      const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ""));

      const name = parts[0] || "";
      const businessName = parts[1] || undefined;
      const phone = parts[2] || undefined;
      const city = parts[3] || undefined;
      const gstin = parts[4] || undefined;
      const credit = parts[5] ? Number(parts[5].replace(/[^\d.]/g, "")) : null;
      const terms = parts[6] ? Number(parts[6].replace(/\D/g, "")) : null;
      const notes = parts[7] || undefined;

      if (!name) {
        rows.push({
          line: i + 1,
          name: "",
          businessName,
          status: "error",
          message: "Missing name",
        });
        errorCount++;
        continue;
      }

      const warnings: string[] = [];
      if (!phone) warnings.push("No phone");

      const status: ParsedBuyerRow["status"] = warnings.length > 0 ? "warning" : "valid";
      if (status === "valid") validCount++;
      else warningCount++;

      rows.push({
        line: i + 1,
        name,
        businessName,
        phone,
        city,
        gstin,
        creditLimit: Number.isFinite(credit) ? credit : null,
        paymentTermsDays: Number.isFinite(terms) ? terms : null,
        notes,
        status,
        message: warnings.length > 0 ? warnings.join(" · ") : undefined,
      });
    }

    setParsedResult({
      fileName: "Pasted Data",
      totalRows: rows.length,
      validCount,
      warningCount,
      errorCount,
      detectedColumns: ["Name", "Business", "Phone", "City", "GSTIN", "Credit", "Terms", "Notes"],
      rows,
    });
  }

  async function handleImport() {
    if (!parsedResult || parsedResult.rows.length === 0) {
      return setError("Please upload a file or paste data with valid customer records.");
    }

    const importable = parsedResult.rows
      .filter((r) => r.status !== "error" && Boolean(r.name))
      .map((r) => ({
        name: r.name,
        businessName: r.businessName,
        phone: r.phone,
        email: r.email,
        city: r.city,
        gstin: r.gstin,
        creditLimit: r.creditLimit,
        paymentTermsDays: r.paymentTermsDays,
        notes: r.notes,
        customerTier: (r.customerTier && CUSTOMER_TIERS.includes(r.customerTier)
          ? r.customerTier
          : "new_prospect") as CustomerTier,
        tags: r.tags,
      }));

    if (importable.length === 0) {
      return setError("No valid records found to import. Check that each row has at least a buyer or business name.");
    }

    setImporting(true);
    setError(null);

    const res = await importBuyersAction({ buyers: importable });
    setImporting(false);

    if (!res.ok) {
      return setError(res.error);
    }

    toast.show({
      kind: "success",
      title: `Import completed! Added ${res.inserted} new buyer${res.inserted === 1 ? "" : "s"}, updated ${res.updated}.`,
    });

    handleClose();
    onSuccess();
  }

  const importableCount =
    parsedResult?.rows.filter((r) => r.status !== "error" && Boolean(r.name)).length ?? 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Customer & Buyer Data"
      description="Upload an Excel spreadsheet (.xlsx), CSV, TSV, or paste tabular customer data."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="type-caption text-fg-muted">
            {parsedResult
              ? `${importableCount} ready to import (${parsedResult.errorCount} skipped)`
              : "Supports Excel (.xlsx), CSV, TSV"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={importing}>
              Cancel
            </Button>
            <Button
              loading={importing}
              disabled={importableCount === 0 || parsing}
              onClick={() => void handleImport()}
            >
              Import {importableCount > 0 ? `${importableCount} Buyers` : "Data"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? <Banner tone="danger">{error}</Banner> : null}

        {/* Tab switcher */}
        <div className="flex border-b border-border-subtle">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`flex items-center gap-2 px-4 py-2.5 type-small font-semibold border-b-2 transition-colors ${
              mode === "file"
                ? "border-gold text-fg"
                : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            <FileSpreadsheet aria-hidden="true" className="size-icon-sm" />
            Upload File (.xlsx, .csv)
          </button>
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`flex items-center gap-2 px-4 py-2.5 type-small font-semibold border-b-2 transition-colors ${
              mode === "paste"
                ? "border-gold text-fg"
                : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            <FileText aria-hidden="true" className="size-icon-sm" />
            Paste Text / Spreadsheet
          </button>
        </div>

        {mode === "file" ? (
          <div className="flex flex-col gap-4">
            {/* Drag & Drop Zone */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,.tsv,.txt,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  void handleFile(e.target.files[0]);
                }
              }}
            />

            {!selectedFile ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? "border-gold bg-surface-2"
                    : "border-border-strong hover:border-gold hover:bg-surface-2/60 bg-surface"
                }`}
              >
                <div className="rounded-full bg-surface-2 p-3 text-gold-text">
                  <Upload aria-hidden="true" className="size-icon-lg" />
                </div>
                <div>
                  <p className="type-body font-semibold">
                    Drag and drop your customer spreadsheet here
                  </p>
                  <p className="type-caption text-fg-muted mt-1">
                    Or click to browse from your computer
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                  <span className="rounded-md bg-surface-2 px-2 py-0.5 type-caption font-mono text-fg-muted">
                    .xlsx
                  </span>
                  <span className="rounded-md bg-surface-2 px-2 py-0.5 type-caption font-mono text-fg-muted">
                    .csv
                  </span>
                  <span className="rounded-md bg-surface-2 px-2 py-0.5 type-caption font-mono text-fg-muted">
                    .tsv
                  </span>
                  <span className="rounded-md bg-surface-2 px-2 py-0.5 type-caption font-mono text-fg-muted">
                    .txt
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-2 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet aria-hidden="true" className="size-icon-lg text-gold-text shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate type-small font-semibold text-fg">
                      {selectedFile.name}
                    </p>
                    <p className="type-caption text-fg-muted">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                      {parsing ? " · Reading file contents…" : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<X aria-hidden="true" className="size-icon-sm" />}
                  onClick={resetState}
                  disabled={parsing || importing}
                  aria-label="Remove selected file"
                >
                  Change
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Textarea
              label="Paste rows from Excel, Google Sheets, or WhatsApp"
              rows={6}
              value={rawText}
              onChange={(e) => parsePastedText(e.target.value)}
              placeholder="Paste columns: Name, Business, Phone, City, GSTIN, Credit Limit, Terms&#10;e.g.&#10;Rajesh Patel&#9;Patel Garments&#9;9825123456&#9;Surat&#9;24AABCU9603R1ZM"
              helper="Columns can be separated by tabs, commas, or semicolons. First row can be headers."
            />
          </div>
        )}

        {/* Parsed Preview Table */}
        {parsedResult && parsedResult.rows.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
              <div className="flex items-center gap-2">
                <h3 className="type-small font-semibold">Preview Data</h3>
                <span className="type-caption text-fg-muted">
                  ({parsedResult.totalRows} rows detected)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="success">{parsedResult.validCount} valid</Badge>
                {parsedResult.warningCount > 0 ? (
                  <Badge tone="warning">{parsedResult.warningCount} warnings</Badge>
                ) : null}
                {parsedResult.errorCount > 0 ? (
                  <Badge tone="danger">{parsedResult.errorCount} skipped</Badge>
                ) : null}
              </div>
            </div>

            <div className="max-h-60 overflow-auto rounded-lg border border-border-subtle bg-surface">
              <table className="w-full border-collapse type-caption">
                <thead className="sticky top-0 bg-surface-2 text-fg-muted border-b border-border-subtle">
                  <tr>
                    <th scope="col" className="py-2 px-2.5 text-left font-semibold">#</th>
                    <th scope="col" className="py-2 px-2.5 text-left font-semibold">Status</th>
                    <th scope="col" className="py-2 px-2.5 text-left font-semibold">Name</th>
                    <th scope="col" className="py-2 px-2.5 text-left font-semibold">Business</th>
                    <th scope="col" className="py-2 px-2.5 text-left font-semibold">Phone</th>
                    <th scope="col" className="py-2 px-2.5 text-left font-semibold">City</th>
                    <th scope="col" className="py-2 px-2.5 text-left font-semibold">GSTIN</th>
                    <th scope="col" className="py-2 px-2.5 text-right font-semibold">Credit (₹)</th>
                    <th scope="col" className="py-2 px-2.5 text-right font-semibold">Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {parsedResult.rows.map((row) => (
                    <tr
                      key={row.line}
                      className={row.status === "error" ? "bg-danger/10" : "hover:bg-surface-2/40"}
                    >
                      <td className="py-1.5 px-2.5 text-fg-muted font-mono">{row.line}</td>
                      <td className="py-1.5 px-2.5 whitespace-nowrap">
                        {row.status === "valid" ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <CheckCircle2 aria-hidden="true" className="size-3" />
                            Ready
                          </span>
                        ) : row.status === "warning" ? (
                          <span
                            className="inline-flex items-center gap-1 text-warning"
                            title={row.message}
                          >
                            <AlertTriangle aria-hidden="true" className="size-3" />
                            Warning
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-danger"
                            title={row.message}
                          >
                            <AlertCircle aria-hidden="true" className="size-3" />
                            Skipped
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 font-medium text-fg">
                        {row.name || <span className="italic text-danger">Missing</span>}
                      </td>
                      <td className="py-1.5 px-2.5 text-fg-muted">{row.businessName ?? "—"}</td>
                      <td className="py-1.5 px-2.5 font-mono text-fg">{row.phone ?? "—"}</td>
                      <td className="py-1.5 px-2.5 text-fg-muted">{row.city ?? "—"}</td>
                      <td className="py-1.5 px-2.5 font-mono text-fg-muted">{row.gstin ?? "—"}</td>
                      <td className="py-1.5 px-2.5 text-right tabular text-fg-muted">
                        {row.creditLimit ? `₹${row.creditLimit.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="py-1.5 px-2.5 text-right tabular text-fg-muted">
                        {row.paymentTermsDays ? `${row.paymentTermsDays}d` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
