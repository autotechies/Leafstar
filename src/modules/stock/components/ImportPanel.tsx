"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Banner } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { formatNumber } from "@/lib/numbers";
import { checkImportAction, commitImportAction, undoStockEntryAction } from "../actions";
import type { ImportCheck } from "../importer";

/* Import from Excel/CSV: check first (nothing is saved), fix the file if needed, then import the same file. */

export function ImportPanel() {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);

  const form = () => {
    const f = new FormData();
    if (file) f.set("file", file);
    return f;
  };

  async function runCheck(chosen: File) {
    setFile(chosen);
    setCheck(null);
    setError(null);
    setBusy("check");
    const body = new FormData();
    body.set("file", chosen);
    const result = await checkImportAction(body);
    setBusy(null);
    if (result.ok) setCheck(result.check);
    else setError(result.error);
  }

  async function runImport() {
    setBusy("import");
    setError(null);
    const result = await commitImportAction(form());
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setFile(null);
    setCheck(null);
    if (input.current) input.current.value = "";
    toast.undo({
      title: `Imported ${formatNumber(result.pieces)} pieces across ${result.articles} article${result.articles === 1 ? "" : "s"}`,
      description: "New articles are hidden until they have photos. Undo within 15 seconds if this was a mistake.",
      onUndo: async () => {
        const undone = await undoStockEntryAction({ batchId: result.batchId });
        toast.show(undone.ok ? { kind: "success", title: "Undone. The imported stock was taken off again." } : { kind: "error", title: undone.error });
        router.refresh();
      },
    });
    router.refresh();
  }

  const badRows = check ? new Set(check.problems.map((p) => p.line)).size : 0;
  const clean = check && check.problems.length === 0 && check.rows.length > 0;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="type-h3">Import from Excel</h2>
        <p className="type-small text-fg-muted">
          One row per article, colour and size. Download the template, paste your stock into it, and upload it here. Nothing is saved until every row is correct, and importing only adds pieces.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a href="/api/stock/template" className={buttonClasses({ variant: "secondary" })}>
          <Download aria-hidden="true" className="size-icon-sm" />
          Download template
        </a>
        <label className="inline-flex">
          <input
            ref={input}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="peer sr-only"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) void runCheck(chosen);
            }}
          />
          <span className={`${buttonClasses({ variant: "primary" })} cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring`}>
            <FileSpreadsheet aria-hidden="true" className="size-icon-sm" />
            {busy === "check" ? "Checking…" : "Choose file"}
          </span>
        </label>
        {file ? <span className="type-small text-fg-muted">{file.name}</span> : null}
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      {check ? (
        <div className="flex flex-col gap-3">
          {check.problems.length > 0 ? (
            <>
              <Banner tone="warning">
                {badRows} row{badRows === 1 ? "" : "s"} need fixing. Nothing was saved. Correct the file and choose it again.
              </Banner>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="type-small text-fg-muted">
                      <th scope="col" className="px-3 py-2 font-semibold">Row</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.problems.slice(0, 200).map((p, i) => (
                      <tr key={`${p.line}-${i}`} className="border-t border-border type-small">
                        <td className="tabular px-3 py-2">{p.line}</td>
                        <td className="px-3 py-2">{p.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {check.problems.length > 200 ? <p className="type-small text-fg-muted">Showing the first 200 problems.</p> : null}
            </>
          ) : (
            <Banner tone="info">
              All {check.rows.length} rows are correct: {check.summary.articles} article{check.summary.articles === 1 ? "" : "s"}, {check.summary.colours} colour{check.summary.colours === 1 ? "" : "s"}, {formatNumber(check.summary.pieces)} pieces.
            </Banner>
          )}
          {clean ? (
            <div>
              <Button loading={busy === "import"} onClick={() => void runImport()}>
                Import {formatNumber(check.summary.pieces)} pieces
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
