import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { processNextJob } from "@/modules/bills/process";
import { IMAGE_BUCKET, STAGING_BUCKET } from "@/modules/images/constants";

/*
  Every recurring cleanup in one place. Each task is independent: one failing never stops the others,
  and every task reports what it did. Later steps add their tasks here (stuck bill scans in Step 7, etc.).
*/

export interface MaintenanceReport {
  tasks: Record<string, { ok: boolean; detail: string }>;
}

type Admin = SupabaseClient<Database>;

async function removeOrphanPhotos(admin: Admin): Promise<string> {
  const { data: folders, error } = await admin.rpc("orphan_image_folders", { older_than: "1 day" });
  if (error) throw error;
  if (!folders?.length) return "none";
  const paths = folders.flatMap((f) => ["thumb.webp", "medium.webp", "large.webp"].map((n) => `${f}/${n}`));
  const removed = await admin.storage.from(IMAGE_BUCKET).remove(paths);
  if (removed.error) throw removed.error;
  const { data: forgotten, error: forgetError } = await admin.rpc("forget_image_folders", { folders });
  if (forgetError) throw forgetError;
  return `${forgotten ?? 0} unused photo(s) removed`;
}

/** Raw uploads that were never processed (closed tab, failed network) older than a day. */
async function clearStaging(admin: Admin): Promise<string> {
  const bucket = admin.storage.from(STAGING_BUCKET);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const { data: owners, error } = await bucket.list("", { limit: 100 });
  if (error) throw error;
  let removed = 0;
  for (const owner of owners ?? []) {
    const { data: files } = await bucket.list(owner.name, { limit: 100 });
    const stale = (files ?? []).filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoff).map((f) => `${owner.name}/${f.name}`);
    if (stale.length) {
      await bucket.remove(stale);
      removed += stale.length;
    }
  }
  return removed ? `${removed} unfinished upload(s) removed` : "none";
}

async function purgeRateLimits(admin: Admin): Promise<string> {
  const { data, error } = await admin.rpc("purge_rate_limits");
  if (error) throw error;
  return `${data ?? 0} old counter(s) removed`;
}

/** A job that was claimed and then lost (crash, timeout) goes back in the queue; queued bills left behind are read now. */
async function finishScans(admin: Admin): Promise<string> {
  const { data: reset, error } = await admin.rpc("reset_stuck_scan_jobs");
  if (error) throw error;
  let done = 0;
  // A handful per run keeps this inside the function's time limit; the next run continues.
  for (let i = 0; i < 3; i++) {
    const outcome = await processNextJob(admin);
    if (!outcome) break;
    done += 1;
  }
  return `${reset ?? 0} stuck job(s) reset, ${done} queued bill(s) read`;
}

export async function runMaintenance(admin: Admin): Promise<MaintenanceReport> {
  const tasks: MaintenanceReport["tasks"] = {};
  const jobs: Array<[string, () => Promise<string>]> = [
    ["unused-photos", () => removeOrphanPhotos(admin)],
    ["unfinished-uploads", () => clearStaging(admin)],
    ["rate-limit-counters", () => purgeRateLimits(admin)],
    ["bill-scans", () => finishScans(admin)],
  ];
  for (const [name, job] of jobs) {
    try {
      tasks[name] = { ok: true, detail: await job() };
    } catch (error) {
      console.error(`[maintenance] ${name}`, error);
      tasks[name] = { ok: false, detail: error instanceof Error ? error.message : "failed" };
    }
  }
  return { tasks };
}
