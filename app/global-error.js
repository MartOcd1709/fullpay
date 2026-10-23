"use client";

// Last line of defence: the root layout itself failed. Plain markup and inline styles only (no app CSS may have loaded).
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f3f5f9", color: "#1a2233" }}>
        <main role="alert" style={{ maxWidth: 560, margin: "15vh auto", padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>FullPay could not open this page · यह पेज नहीं खुल सका</h1>
          <p style={{ fontSize: 16 }}>Please try again. If it keeps happening, the page will work again after a refresh. · कृपया फिर कोशिश करें।</p>
          {error?.digest && <p style={{ fontFamily: "monospace", color: "#4b5566" }}>Reference: {error.digest}</p>}
          <button type="button" onClick={reset} style={{ minHeight: 48, padding: "0 20px", borderRadius: 12, border: 0, background: "#213f9a", color: "#fff", fontSize: 16, fontWeight: 600 }}>
            Try again · फिर कोशिश करें
          </button>
        </main>
      </body>
    </html>
  );
}
