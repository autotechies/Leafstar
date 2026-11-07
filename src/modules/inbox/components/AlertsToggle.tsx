"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/* Turns phone/browser alerts on or off for THIS device. Needs the app opened from the home screen on iPhone. */

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function AlertsToggle({ publicKey }: { publicKey: string | null }) {
  const toast = useToast();
  const [state, setState] = useState<"checking" | "unsupported" | "off" | "on" | "blocked">("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        setState((await reg.pushManager.getSubscription()) ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, [publicKey]);

  async function turnOn() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const response = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!response.ok) throw new Error("save failed");
      setState("on");
      toast.show({ kind: "success", title: "Alerts are on for this device." });
    } catch {
      toast.show({ kind: "error", title: "Could not turn on alerts. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      toast.show({ kind: "success", title: "Alerts are off for this device." });
    } catch {
      toast.show({ kind: "error", title: "Could not turn off alerts. Try again." });
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") return null;
  if (state === "unsupported") return <p className="type-small text-fg-muted">{publicKey ? "This browser cannot show phone alerts. On iPhone, add the app to your Home Screen first." : "Phone alerts are not set up yet (see the setup notes)."}</p>;
  if (state === "blocked") return <p className="type-small text-fg-muted">Alerts are blocked in this browser. Allow notifications for this site in your browser settings.</p>;
  return state === "on" ? (
    <Button variant="secondary" loading={busy} icon={<BellOff aria-hidden="true" className="size-icon" />} onClick={() => void turnOff()}>Turn off alerts here</Button>
  ) : (
    <Button variant="secondary" loading={busy} icon={<Bell aria-hidden="true" className="size-icon" />} onClick={() => void turnOn()}>Turn on alerts here</Button>
  );
}
