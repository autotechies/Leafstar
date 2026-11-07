"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Undo2 } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatNumber } from "@/lib/numbers";
import { undoBillAction } from "../actions";
import type { HistoryRow } from "../types";

const tone: Record<HistoryRow["status"], BadgeTone> = { applied: "success", draft: "warning", undone: "neutral" };
const label: Record<HistoryRow["status"], string> = { applied: "Applied", draft: "Draft", undone: "Undone" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "");

export function BillHistory({ rows }: { rows: HistoryRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [undoing, setUndoing] = useState<HistoryRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function undo() {
    if (!undoing) return;
    setBusy(true);
    const r = await undoBillAction(undoing.id);
    setBusy(false);
    setUndoing(null);
    toast.show(r.ok ? { kind: "success", title: "Bill undone. Its stock was put back." } : { kind: "error", title: r.error });
    router.refresh();
  }

  const columns: Column<HistoryRow>[] = [
    { key: "bill", header: "Bill", primary: true, render: (r) => <Link href={`/admin/bills/review/${r.id}`} className="rounded-sm font-semibold hover:underline focus-ring">{r.billNumber ? `No. ${r.billNumber}` : "No number"}</Link> },
    { key: "buyer", header: "Buyer", render: (r) => r.buyer ?? "Unknown" },
    { key: "date", header: "Bill date", hideOnPhone: true, render: (r) => r.billDate ?? "" },
    { key: "pieces", header: "Pieces", align: "right", render: (r) => formatNumber(r.pieces) },
    { key: "status", header: "Status", render: (r) => <Badge tone={tone[r.status]}>{label[r.status]}</Badge> },
    { key: "when", header: "Applied", hideOnPhone: true, render: (r) => fmt(r.appliedAt) },
    { key: "action", header: "", align: "right", render: (r) => (r.status === "applied" ? <Button size="sm" variant="ghost" icon={<Undo2 aria-hidden="true" className="size-icon-sm" />} onClick={() => setUndoing(r)}>Undo</Button> : r.status === "draft" ? <Link href={`/admin/bills/review/${r.id}`} className={buttonClasses({ size: "sm", variant: "secondary" })}>Review</Link> : null) },
  ];

  return (
    <>
      <Card padding="none">
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} caption="Bills" empty={<EmptyState icon={FileText} title="No bills yet" description="Bills you scan and apply appear here, each with an Undo." action={<Link href="/admin/bills/scan" className={buttonClasses()}>Scan bills</Link>} />} />
      </Card>
      <Modal
        open={Boolean(undoing)}
        onClose={() => setUndoing(null)}
        title="Undo this bill?"
        description={undoing ? `Bill ${undoing.billNumber ?? ""} from ${undoing.buyer ?? "an unknown buyer"}: ${formatNumber(undoing.pieces)} pieces will be added back to stock.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUndoing(null)}>Keep it applied</Button>
            <Button variant="danger" loading={busy} onClick={() => void undo()}>Undo bill</Button>
          </>
        }
      >
        <p className="type-body text-fg-muted">A bill can be undone once. If you need it again, upload it again.</p>
      </Modal>
    </>
  );
}
