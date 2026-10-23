import { inr, day } from "@/components/public/lang";
import { t as translate } from "@/lib/i18n";

const pct = (bps) => `${(bps / 100).toFixed(2)}%`;

// MSMED s.16 interest, one row per period (rate change, monthly rest, payment, dispute), inclusive dates,
// with the RBI source per row (K9), the 0% dispute spans and interest-first part payments spelled out.
export default function InterestTable({ interest, gst, asOfLabel }) {
  const t = (k, v) => translate(k, "en", v);
  const disputes = interest.segments.filter((s) => s.dispute);
  return (
    <div className="pf-section">
      <table className="pf-table">
        <thead>
          <tr>
            <th>{t("public.int.from")}</th>
            <th>{t("public.int.to")}</th>
            <th className="r">{t("public.int.days")}</th>
            <th>{t("public.int.bank_rate")}</th>
            <th className="r">{t("public.int.rate")}</th>
            <th className="r">{t("public.int.base")}</th>
            <th className="r">{t("print.interest")}</th>
          </tr>
        </thead>
        <tbody>
          {interest.segments.map((s) => (
            <tr key={s.from}>
              <td>{day(s.from)}</td>
              <td>{day(s.to)}</td>
              <td className="r">{s.days}</td>
              <td>
                {pct(s.bank_rate_bps)}
                <span className="pf-small block">
                  {s.prid ? t("public.int.source_prid", { date: day(s.rbi_from), prid: s.prid }) : t("public.int.source", { date: day(s.rbi_from) })}
                </span>
              </td>
              <td className="r">{s.dispute ? <>0%<span className="pf-small block">{t("public.int.dispute_row")}</span></> : pct(s.rate_bps)}</td>
              <td className="r">{inr(s.base_paise)}</td>
              <td className="r">{inr(s.interest_paise)}</td>
            </tr>
          ))}
          <tr>
            <th colSpan={6}>{t("public.int.total", { date: asOfLabel })}</th>
            <td className="r font-bold">{inr(interest.total_interest_paise)}</td>
          </tr>
        </tbody>
      </table>
      <ul className="pf-small mt-1" style={{ listStyle: "disc", paddingLeft: "5mm" }}>
        {disputes.length > 0 && <li>{t("public.int.dispute_span", { from: day(disputes[0].from), to: day(disputes.at(-1).to) })}</li>}
        {interest.allocations_applied.map((a, i) => (
          <li key={i}>{t("public.int.part_payment", { amount: inr(a.amount_paise), date: day(a.date), to_interest: inr(a.to_interest_paise), to_principal: inr(a.to_principal_paise) })}</li>
        ))}
        {interest.rests.length > 0 && <li>{t("public.int.rests", { dates: interest.rests.map((d) => day(d)).join(", ") })}</li>}
      </ul>
      {gst && (
        <div className="mt-2">
          {gst.buckets.map((g) => (
            <p key={g.bps}>
              {gst.interstate
                ? t("public.int.gst_igst", { rate: g.bps / 100, amount: inr(g.gst_paise) })
                : t("public.int.gst_cgst", { rate: g.bps / 100, half: g.bps / 200, amount: inr(g.gst_paise) })}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
