"use client";

/* The last safety net: if even the page frame fails, show something calm instead of a blank screen. It uses no app components, since they may be what failed. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      {/* No stylesheet is loaded when the page frame itself fails, so this one page styles itself. */}
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px" }}>
        <main>
          <h1>This page couldn’t load</h1>
          <p>A server error occurred. Reload to try again.</p>
          {/* Same reason: no stylesheet here. */}
          <button type="button" onClick={reset} style={{ padding: "12px 24px", fontSize: "16px" }}>Reload</button>
          {/* Same reason: no stylesheet here. */}
          <p style={{ fontSize: "12px", opacity: 0.6 }}>Code: {error.digest ?? "none"}</p>
        </main>
      </body>
    </html>
  );
}
