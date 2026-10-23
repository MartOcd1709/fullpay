import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Payments" };

export default function PaymentsPage() {
  return (
    <>
      <PageHeader title="Payments" />
      <EmptyState title="Nothing to show yet" description="This screen will import the bank statement CSV or take a payment by hand, match each credit to invoices with a confidence and reason, flag part payments, one payment covering several invoices, overpayments, unmatched deposits and possible TDS, and ask you to confirm before anything is marked paid." />
    </>
  );
}
