import test from "node:test";
import assert from "node:assert/strict";
import { parseInvoiceCsv, parseDate, parseAmount } from "../lib/invoiceImport.js";

test("dates and amounts the way Indian exports write them", () => {
  assert.equal(parseDate("01/04/2026"), "2026-04-01");
  assert.equal(parseDate("1-4-26"), "2026-04-01");
  assert.equal(parseDate("1-Apr-26"), "2026-04-01");
  assert.equal(parseDate("01 April 2026"), "2026-04-01");
  assert.equal(parseDate("2026-04-01"), "2026-04-01");
  assert.equal(parseDate("31/02/2026"), null);
  assert.equal(parseAmount("₹1,23,456.50"), 12345650);
  assert.equal(parseAmount("12,000.00 Dr"), 1200000);
  assert.equal(parseAmount("500.00 Cr"), -50000);
  assert.equal(parseAmount("(250)"), -25000);
  assert.equal(parseAmount("abc"), null);
});

test("a Tally Bills Receivable export: title block, Dr balances, total line", () => {
  const csv = [
    "Arora Auto Components,,,,,",
    "Bills Receivable,,,,,",
    "1-Apr-26 to 23-Oct-26,,,,,",
    "Date,Ref. No.,Party's Name,Pending Amount,Due on,Overdue by days",
    "2-Sep-26,TI/0412,Rana Transport Company,\"1,18,000.00 Dr\",17-Sep-26,36",
    "15-Sep-26,TI/0431,Garewal Motors,\"54,280.00 Dr\",30-Sep-26,23",
    "15-Sep-26,TI/0431,Garewal Motors,\"1,000.00 Dr\",30-Sep-26,23",
    "20-Sep-26,TI/0440,Bajwa Logistics,\"2,000.00 Cr\",5-Oct-26,18",
    ",,Grand Total,\"1,73,280.00 Dr\",,",
  ].join("\n");
  const r = parseInvoiceCsv(csv);
  assert.equal(r.ok, true);
  assert.equal(r.header_line, 4);
  assert.deepEqual(Object.keys(r.mapping).sort(), ["balance", "customer", "date", "due", "number"]);
  assert.equal(r.rows.length, 4, "the Grand Total line is dropped");
  assert.deepEqual(r.rows[0].value, {
    number: "TI/0412", date: "2026-09-02", customer: "Rana Transport Company", gstin: null,
    total_paise: 11800000, balance_paise: 11800000, received_paise: null, due_date: "2026-09-17", email: null, phone: null,
  });
  assert.deepEqual(r.rows[0].errors, []);
  assert.deepEqual(r.rows[2].errors, ["duplicate_in_file"]);
  assert.deepEqual(r.rows[3].errors, ["credit_balance"], "a Cr balance is an advance, not an invoice to chase");
  assert.equal(r.rows[3].line, 8);
});

test("a Vyapar-style sale report with received amounts", () => {
  const csv = "Invoice No,Date,Party Name,GSTIN,Total Amount,Received Amount,Due Date,Phone No\n" +
    "45,05/10/2026,Yadav Agro Implements,09aaacy1234f1z5,\"25,000.00\",\"10,000.00\",20/10/2026,9876543210\n" +
    "46,06/10/2026,,,100.00,0,,\n";
  const r = parseInvoiceCsv(csv);
  assert.equal(r.rows[0].value.balance_paise, 1500000);
  assert.equal(r.rows[0].value.gstin, "09AAACY1234F1Z5");
  assert.deepEqual(r.rows[1].errors, ["no_customer"]);
  assert.equal(parseInvoiceCsv("a,b\n1,2").error, "no_header");
});
