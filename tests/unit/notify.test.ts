import { beforeEach, describe, expect, it, vi } from "vitest";

/* notifyOwner with Supabase replaced by a fake: it sends what it should and never throws. */

let alertEmail: string | null = "owner@example.com";
let subs = [{ id: "s1", endpoint: "https://push/1", p256dh: "p", auth: "a" }, { id: "s2", endpoint: "https://push/2", p256dh: "p", auth: "a" }];
const deleted: string[] = [];
let failRead = false;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({ serverEnv: () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "business_settings") return { select: () => ({ limit: () => ({ maybeSingle: async () => { if (failRead) throw new Error("db down"); return { data: { alert_email: alertEmail } }; } }) }) };
      return { select: async () => ({ data: subs }), delete: () => ({ eq: async (_c: string, id: string) => { deleted.push(id); return { error: null }; } }) };
    },
  }),
}));

import { notifyOwner } from "@/modules/notify/notify";

beforeEach(() => {
  alertEmail = "owner@example.com";
  failRead = false;
  deleted.length = 0;
  subs = [{ id: "s1", endpoint: "https://push/1", p256dh: "p", auth: "a" }, { id: "s2", endpoint: "https://push/2", p256dh: "p", auth: "a" }];
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("notifyOwner", () => {
  it("emails the private alert address and pushes to every device", async () => {
    const emails: string[] = [];
    const pushes: string[] = [];
    await notifyOwner({ title: "A buyer is waiting", body: "Ravi asked for a price." }, {
      sendEmail: async (to) => { emails.push(to); },
      sendPush: async (sub, payload) => { pushes.push(`${sub.endpoint}:${JSON.parse(payload).url}`); return { gone: false }; },
    });
    expect(emails).toEqual(["owner@example.com"]);
    expect(pushes).toEqual(["https://push/1:/admin/inbox", "https://push/2:/admin/inbox"]);
  });
  it("skips email when no alert address is set", async () => {
    alertEmail = null;
    const emails: string[] = [];
    await notifyOwner({ title: "t", body: "b" }, { sendEmail: async (to) => { emails.push(to); }, sendPush: async () => ({ gone: false }) });
    expect(emails).toEqual([]);
  });
  it("forgets a device the push service says is gone", async () => {
    await notifyOwner({ title: "t", body: "b" }, { sendEmail: async () => undefined, sendPush: async (sub) => ({ gone: sub.endpoint.endsWith("/2") }) });
    expect(deleted).toEqual(["s2"]);
  });
  it("one failing channel never stops the other and nothing throws", async () => {
    const pushes: string[] = [];
    await expect(
      notifyOwner({ title: "t", body: "b" }, {
        sendEmail: async () => { throw new Error("Resend down"); },
        sendPush: async (sub) => { pushes.push(sub.endpoint); return { gone: false }; },
      }),
    ).resolves.toBeUndefined();
    expect(pushes).toHaveLength(2);
  });
  it("does not throw when the database cannot be read", async () => {
    failRead = true;
    await expect(notifyOwner({ title: "t", body: "b" })).resolves.toBeUndefined();
  });
});
