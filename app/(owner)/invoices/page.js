import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Invoices" };

export default function InvoicesPage() {
  return (
    <>
      <PageHeader title="Invoices" />
      <EmptyState title="Nothing to show yet" description="This screen will list every invoice with filters (customer, status, due date, days overdue) and search. Statuses: draft, sent, due soon, overdue, part paid, paid, disputed. Opening an invoice shows its timeline." />
    </>
  );
}
