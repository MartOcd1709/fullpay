// TReDS (RBI-licensed exchanges: RXIL, M1xchange, Invoicemart): an MSME sells a big buyer's accepted invoice to a
// financier before the due date; the buyer pays the financier on the due date. Pure estimate, money in paise.

// Cash today ≈ amount less the financier's discount for the days until the due date, at an annual rate band.
export function tredsEstimate({ outstanding_paise, today, due_date, low_bps, high_bps, daysBetween }) {
  const days = daysBetween(today, due_date);
  if (!(outstanding_paise > 0) || days <= 0) return null; // overdue invoices cannot be discounted there
  const cash = (bps) => outstanding_paise - Math.ceil((outstanding_paise * bps * days) / (10000 * 365));
  return { days, cash_high_paise: cash(low_bps), cash_low_paise: cash(high_bps) };
}

// What the seller needs before an invoice can go on TReDS.
export function sellerReady(business) {
  return { udyam: business?.udyam === true, gstin: Boolean(business?.gstin) && business?.registration !== "unregistered" };
}
