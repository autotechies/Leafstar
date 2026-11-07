/* One way for every public form to talk to its route and to read the answer. */

export type SubmitResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function submitJson(url: string, body: unknown): Promise<SubmitResult> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | null;
    if (response.ok && data?.ok) return { ok: true };
    if (response.status === 429) return { ok: false, error: "You have sent several requests. Please wait a few minutes, or call us." };
    return { ok: false, error: data?.error ?? "We could not send that. Please try again, or call us.", fieldErrors: data?.fieldErrors };
  } catch {
    return { ok: false, error: "No connection. Check your internet and try again." };
  }
}

/** The assistant's chat widget listens for this (Step 8). */
export function openChat(articleCode?: string) {
  window.dispatchEvent(new CustomEvent("ls:open-chat", { detail: { articleCode: articleCode ?? null } }));
}
