import Qr from "@/components/public/Qr";
import PrintToolbar from "./PrintToolbar";
import { t as translate } from "@/lib/i18n";

// A4 frame for the three print pages: @page size and margins, page numbers and the record stamp in the page
// margin boxes (Chrome 131+), a screen-only toolbar, and a closing stamp with a 20 mm verify QR. No app chrome.
const css = ({ footLeft, pageText }) => `
@page { size: A4; margin: 12mm 12mm 16mm;
  @bottom-left { content: "${footLeft}"; font: 7.5pt system-ui, sans-serif; color: #4b5566; }
  @bottom-right { content: ${pageText}; font: 7.5pt system-ui, sans-serif; color: #4b5566; }
}
.pf-body { background: var(--surface-2); color: #111827; }
.pf-sheet { background: #fff; width: 210mm; min-height: 297mm; margin: 0 auto 2rem; padding: 12mm; box-shadow: 0 2px 12px rgb(0 0 0 / .15);
  font-size: 9.5pt; line-height: 1.4; }
.pf-sheet [lang="hi"], .pf-sheet:lang(hi) { line-height: 1.6; }
.pf-sheet h1 { font-size: 15pt; font-weight: 700; line-height: 1.2; }
.pf-sheet h2 { font-size: 11pt; font-weight: 700; margin: 5mm 0 2mm; break-after: avoid; }
.pf-sheet h3 { font-size: 10pt; font-weight: 700; margin: 3mm 0 1mm; }
.pf-sheet p { margin: 1.5mm 0; }
.pf-small { font-size: 8pt; color: #374151; }
.pf-muted { color: #4b5563; }
.pf-hi { font-weight: 400; color: #374151; }
.pf-box { border: 1px solid #9ca3af; border-radius: 2mm; padding: 2.5mm 3mm; }
.pf-strong-box { border: 1.5px solid #111827; border-radius: 2mm; padding: 3mm; font-weight: 600; }
.pf-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.pf-table th, .pf-table td { border: 1px solid #9ca3af; padding: 1.2mm 1.5mm; vertical-align: top; text-align: left; }
.pf-table th { background: #f3f4f6; font-weight: 700; }
.pf-table .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pf-table thead { display: table-header-group; }
.pf-table tr { break-inside: avoid; }
.pf-mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8pt; overflow-wrap: anywhere; }
.pf-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.pf-section { break-inside: avoid; }
.pf-page-break { break-before: page; }
.pf-stamp { display: flex; gap: 4mm; align-items: center; margin-top: 6mm; padding-top: 3mm; border-top: 1px solid #9ca3af; break-inside: avoid; }
.pf-watermark { position: absolute; inset: 30% 0 auto; text-align: center; font-size: 40pt; font-weight: 800; color: rgb(138 26 22 / .14); transform: rotate(-18deg); pointer-events: none; }
@media screen and (max-width: 860px) { .pf-sheet { zoom: .78; } }
@media screen and (max-width: 640px) { .pf-sheet { zoom: .58; } }
@media screen and (max-width: 480px) { .pf-sheet { zoom: .46; } }
@media screen and (max-width: 380px) { .pf-sheet { zoom: .42; } }
@media print {
  .no-print { display: none !important; }
  html, body, .pf-body { background: #fff !important; }
  .pf-sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; zoom: 1; }
}`;

export default async function PrintFrame({ lang, recordHash, verifyUrl, toolbar, children, watermark }) {
  const t = (k, v) => translate(k, "en", v);
  const record = recordHash ? `${t("public.print.record", { hash: recordHash.slice(0, 16) })} · ${verifyUrl}` : "";
  const [before, between, after] = t("print.page").split(/\{n\}|\{total\}/);
  const q = (s) => JSON.stringify(s ?? "");
  const pageText = `${q(before)} counter(page) ${q(between)} counter(pages) ${q(after)}`;
  return (
    <div className="pf-body min-h-dvh">
      <style dangerouslySetInnerHTML={{ __html: css({ footLeft: record.replace(/["\\]/g, ""), pageText }) }} />
      <PrintToolbar s={toolbar.s}>{toolbar.extra}</PrintToolbar>
      <article className="pf-sheet relative" lang="en">
        {watermark && <div className="pf-watermark" aria-hidden="true">{watermark}</div>}
        {children}
        {recordHash && (
          <footer className="pf-stamp">
            <Qr text={verifyUrl} size="20mm" label={t("public.print.verify_qr")} />
            <div className="min-w-0">
              <p className="pf-small font-semibold">{t("public.print.verify_caption")}</p>
              <p className="pf-mono">{verifyUrl}</p>
              <p className="pf-mono pf-muted">{t("public.print.record_full", { hash: recordHash })}</p>
              {lang === "hi" && <p className="pf-small pf-hi" lang="hi">{translate("public.print.verify_caption", "hi")}</p>}
            </div>
          </footer>
        )}
      </article>
    </div>
  );
}

// English heading with the Hindi under it when the reader picked हिंदी (pack: second language under each heading).
export function H({ k, lang, vars, as: Tag = "span" }) {
  return (
    <Tag>
      {translate(k, "en", vars)}
      {lang === "hi" && (
        <span className="pf-hi block" lang="hi">{translate(k, "hi", vars)}</span>
      )}
    </Tag>
  );
}
