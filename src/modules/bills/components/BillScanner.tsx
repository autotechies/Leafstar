"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, FileText, RotateCcw, Trash2, Upload } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Banner, EmptyState } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { approveConfidentAction, checkDuplicateFilesAction, createScanJobsAction, discardScanJobAction, loadQueueAction, retryScanJobAction, startManualBillAction } from "../actions";
import { checkBillFile } from "../formats";
import type { ScanJobRow } from "../types";

/*
  Scan bills (AGENTS.md §10): choose many files, they upload straight to private storage, join the queue, and are read a few at a
  time. Progress is live; every file shows its own state and a way to fix it.
*/

const CONCURRENCY = 3;

async function sha256(file: File): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

async function post<T>(url: string, body: unknown): Promise<T & { ok: boolean; error?: string }> {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await response.json().catch(() => ({ ok: false, error: "No answer from the server." }))) as T & { ok: boolean; error?: string };
}

const statusInfo = (j: ScanJobRow): { tone: BadgeTone; label: string } => {
  if (j.status === "queued") return { tone: "neutral", label: "Waiting" };
  if (j.status === "processing") return { tone: "warning", label: "Reading" };
  if (j.status === "failed") return { tone: "danger", label: "Needs attention" };
  if (j.billStatus === "applied") return { tone: "success", label: "Applied" };
  if (j.billStatus === "undone") return { tone: "neutral", label: "Undone" };
  if (j.unmatched > 0 || j.lines === 0) return { tone: "warning", label: "Review needed" };
  return { tone: "success", label: j.confident ? "Ready to approve" : "Check and apply" };
};

export function BillScanner({ initial }: { initial: ScanJobRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [jobs, setJobs] = useState(initial);
  const [rejected, setRejected] = useState<string[]>([]);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [approving, setApproving] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const driving = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setJobs(await loadQueueAction());
    } catch {
      /* the next poll will try again */
    }
  }, []);

  const drive = useCallback(async () => {
    if (driving.current) return;
    driving.current = true;
    try {
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          for (let i = 0; i < 500; i++) {
            const res = await post<{ idle?: boolean }>("/api/bills/process", {});
            if (!res.ok || res.idle) return;
            void refresh();
          }
        }),
      );
    } finally {
      driving.current = false;
      void refresh();
    }
  }, [refresh]);

  const active = jobs.some((j) => j.status === "queued" || j.status === "processing");

  // Pick up work left over from an earlier visit, and keep the list fresh while anything is running.
  useEffect(() => {
    if (jobs.some((j) => j.status === "queued")) void drive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void refresh(), 3000);
    return () => clearInterval(t);
  }, [active, refresh]);
  // Live updates where Realtime is on; polling above covers the rest.
  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase.channel("bill-scan-jobs").on("postgres_changes", { event: "*", schema: "public", table: "bill_scan_jobs" }, () => void refresh()).subscribe();
    return () => void supabase.removeChannel(channel);
  }, [refresh]);

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    if (!files.length) return;
    const problems: string[] = [];
    const ok: File[] = [];
    for (const f of files) {
      const check = checkBillFile(f.name, f.type, f.size);
      if (check.ok) ok.push(f);
      else problems.push(`${f.name}: ${check.error}`);
    }
    const hashes = await Promise.all(ok.map(sha256));
    const dupes = await checkDuplicateFilesAction(hashes.filter((h): h is string => Boolean(h)));
    const known = new Set(dupes.ok ? dupes.duplicates : []);
    const fresh: Array<{ file: File; hash: string | null }> = [];
    ok.forEach((file, i) => {
      if (hashes[i] && known.has(hashes[i] as string)) problems.push(`${file.name}: this exact file was already uploaded.`);
      else fresh.push({ file, hash: hashes[i] });
    });
    setRejected(problems);
    if (!fresh.length) return;

    const batch = crypto.randomUUID();
    setUploading({ done: 0, total: fresh.length });
    const uploaded: Array<{ path: string; name: string; type: string; size: number; hash: string | null }> = [];
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, fresh.length) }, async () => {
        while (next < fresh.length) {
          const { file, hash } = fresh[next++];
          const signed = await post<{ path: string; token: string }>("/api/bills/sign", { name: file.name, type: file.type, size: file.size, batch });
          if (!signed.ok) {
            problems.push(`${file.name}: ${signed.error ?? "could not start the upload."}`);
          } else {
            const { error } = await supabaseBrowser().storage.from("bills").uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || "application/octet-stream" });
            if (error) problems.push(`${file.name}: the upload did not finish.`);
            else uploaded.push({ path: signed.path, name: file.name, type: file.type, size: file.size, hash });
          }
          setUploading((u) => (u ? { ...u, done: u.done + 1 } : u));
        }
      }),
    );
    setRejected([...problems]);
    if (uploaded.length) {
      const created = await createScanJobsAction({ batch, files: uploaded });
      if (!created.ok) setRejected((r) => [...r, created.error]);
    }
    setUploading(null);
    await refresh();
    void drive();
  }

  async function retry(id: string) {
    const r = await retryScanJobAction(id);
    if (!r.ok) toast.show({ kind: "error", title: r.error });
    await refresh();
    void drive();
  }
  async function discard(id: string) {
    const r = await discardScanJobAction(id);
    toast.show(r.ok ? { kind: "success", title: "Bill discarded." } : { kind: "error", title: r.error });
    await refresh();
  }
  async function byHand(id: string) {
    const r = await startManualBillAction(id);
    if (r.ok) router.push(`/admin/bills/review/${r.billId}`);
    else toast.show({ kind: "error", title: r.error });
  }
  async function approveAll() {
    setApproving(true);
    const r = await approveConfidentAction();
    setApproving(false);
    setConfirmApprove(false);
    if (!r.ok) toast.show({ kind: "error", title: r.error });
    else toast.show({ kind: r.skipped.length ? "warning" : "success", title: `${r.applied} bill${r.applied === 1 ? "" : "s"} applied`, description: r.skipped.length ? `${r.skipped.length} skipped: ${r.skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}` : "Find them in Bills, where each can be undone." });
    await refresh();
  }

  const ready = jobs.filter((j) => j.confident).length;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Upload bills" description="Choose as many as you like: photos, PDFs, Word (.docx), Excel (.xlsx) or CSV. Each is read for you to check before any stock changes." />
        <label
          htmlFor="bill-files"
          className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border-strong px-4 py-12 text-center hover:bg-surface-2 focus-within:outline-2 focus-within:outline-ring"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onFiles(e.dataTransfer.files);
          }}
        >
          <Upload aria-hidden="true" className="size-icon-lg text-gold-text" />
          <span className="type-h4">Choose bills or drop them here</span>
          <span className="type-small text-fg-muted">Up to 100 at a time, 20 MB each</span>
          <input ref={input} id="bill-files" type="file" multiple className="sr-only" accept="image/*,.pdf,.docx,.xlsx,.csv,.heic,.heif" onChange={(e) => void onFiles(e.target.files)} />
        </label>
        {uploading ? (
          <p role="status" className="mt-4 type-small text-fg-muted">Uploading {uploading.done} of {uploading.total}…</p>
        ) : null}
        {rejected.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            <Banner tone="warning">{rejected.length === 1 ? "One file was not added:" : `${rejected.length} files were not added:`}</Banner>
            <ul className="list-disc pl-6 type-small text-fg-muted">
              {rejected.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card padding="none">
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="type-h3">Queue</h2>
            <p role="status" className="type-small text-fg-muted">
              {jobs.length === 0 ? "Nothing here yet." : active ? "Reading your bills. You can leave this page open or come back." : `${jobs.length} bill${jobs.length === 1 ? "" : "s"} from the last 14 days`}
            </p>
          </div>
          {ready > 0 ? (
            <Button icon={<CheckCheck aria-hidden="true" className="size-icon" />} onClick={() => setConfirmApprove(true)}>Approve {ready} ready {ready === 1 ? "bill" : "bills"}</Button>
          ) : null}
        </div>
        {jobs.length === 0 ? (
          <EmptyState icon={FileText} title="No bills yet" description="Upload your first bills above. Stock only changes after you check and apply each one." />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {jobs.map((j) => {
              const s = statusInfo(j);
              return (
                <li key={j.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate type-small font-semibold">{j.fileName}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {j.status === "extracted" && j.lines > 0 ? <span className="type-small text-fg-muted">{j.billNumber ? `Bill ${j.billNumber} · ` : ""}{j.lines} line{j.lines === 1 ? "" : "s"}{j.unmatched ? `, ${j.unmatched} to match` : ""}</span> : null}
                    </div>
                    {j.status === "failed" && j.error ? <p className="type-small text-danger">{j.error}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {j.status === "extracted" && j.billId && j.billStatus === "draft" ? <Link href={`/admin/bills/review/${j.billId}`} className={buttonClasses({ size: "sm" })}>Review</Link> : null}
                    {j.status === "extracted" && j.billId && j.billStatus !== "draft" ? <Link href={`/admin/bills/review/${j.billId}`} className={buttonClasses({ size: "sm", variant: "secondary" })}>View</Link> : null}
                    {j.status === "failed" ? (
                      <>
                        <Button size="sm" variant="secondary" icon={<RotateCcw aria-hidden="true" className="size-icon-sm" />} onClick={() => void retry(j.id)}>Retry</Button>
                        <Button size="sm" variant="ghost" onClick={() => void byHand(j.id)}>Enter by hand</Button>
                      </>
                    ) : null}
                    {j.status !== "processing" && j.billStatus !== "applied" ? (
                      <Button size="sm" variant="ghost" iconOnly aria-label={`Discard ${j.fileName}`} icon={<Trash2 aria-hidden="true" className="size-icon-sm" />} onClick={() => void discard(j.id)} />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        title={`Apply ${ready} ready ${ready === 1 ? "bill" : "bills"}?`}
        description="Stock will be reduced for every line of these bills."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmApprove(false)}>Not yet</Button>
            <Button loading={approving} onClick={() => void approveAll()}>Apply bills</Button>
          </>
        }
      >
        <p className="type-body text-fg-muted">Only bills where every line matched an article with high confidence are included. Each one can be undone later from Bills.</p>
      </Modal>
    </div>
  );
}
