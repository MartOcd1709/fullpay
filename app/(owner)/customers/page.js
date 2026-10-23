import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" />
      <EmptyState title="Nothing to show yet" description="This screen will show each customer with credit days, contact details, total owed, payment record (average days late, % paid on time) and a reliability grade A, B or C with the reason in words." />
    </>
  );
}
