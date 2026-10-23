import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "New invoice" };

export default function NewInvoicePage() {
  return (
    <>
      <PageHeader title="New invoice" />
      <EmptyState title="Nothing to show yet" description="This screen will let you pick or add a customer (GSTIN validated, state taken from it), add items with HSN/SAC, quantity, unit, rate, discount and GST rate, see totals update live with CGST + SGST or IGST, preview the print-ready Tax Invoice with a UPI QR code, and save as a draft or send." />
    </>
  );
}
