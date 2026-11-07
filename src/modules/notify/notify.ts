import "server-only";
import webpush from "web-push";
import { serverEnv } from "@/lib/env.server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/*
  Tells the owner someone is waiting (AGENTS.md §8): an email and a phone/browser push. It NEVER throws and never blocks
  the visitor: a failed alert is logged and the Inbox still has the item. Email goes to the private alert address in Settings.
*/

export interface OwnerAlert { title: string; body: string; url?: string }

export interface NotifyDeps {
  sendEmail?: (to: string, alert: OwnerAlert, siteUrl: string) => Promise<void>;
  sendPush?: (sub: { endpoint: string; p256dh: string; auth: string }, payload: string) => Promise<{ gone: boolean }>;
}

async function defaultEmail(to: string, alert: OwnerAlert, siteUrl: string) {
  const env = serverEnv();
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) return;
  const link = `${siteUrl}${alert.url ?? "/admin/inbox"}`;
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [to],
      subject: alert.title,
      text: `${alert.body}\n\nOpen your Inbox: ${link}`,
      html: `<p>${esc(alert.body)}</p><p><a href="${esc(link)}">Open your Inbox</a></p>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend answered ${response.status}`);
}

async function defaultPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const env = serverEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { gone: false };
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
      vapidDetails: { subject: env.VAPID_SUBJECT ?? "mailto:owner@example.com", publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
      TTL: 60 * 60 * 24,
    });
    return { gone: false };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return { gone: true };
    throw error;
  }
}

export async function notifyOwner(alert: OwnerAlert, deps: NotifyDeps = {}): Promise<void> {
  try {
    const admin = supabaseAdmin();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    const [{ data: settings }, { data: subs }] = await Promise.all([
      admin.from("business_settings").select("alert_email").limit(1).maybeSingle(),
      admin.from("push_subscriptions").select("id, endpoint, p256dh, auth"),
    ]);
    const email = deps.sendEmail ?? defaultEmail;
    const push = deps.sendPush ?? defaultPush;
    const jobs: Array<Promise<unknown>> = [];
    if (settings?.alert_email) {
      jobs.push(email(settings.alert_email, alert, siteUrl).catch((e) => console.error("[notify] email failed", e)));
    }
    const payload = JSON.stringify({ title: alert.title, body: alert.body, url: alert.url ?? "/admin/inbox" });
    for (const sub of subs ?? []) {
      jobs.push(
        push(sub, payload)
          .then(async (r) => {
            if (r.gone) await admin.from("push_subscriptions").delete().eq("id", sub.id);
          })
          .catch((e) => console.error("[notify] push failed", e)),
      );
    }
    await Promise.all(jobs);
  } catch (error) {
    console.error("[notify] could not notify the owner", error);
  }
}
