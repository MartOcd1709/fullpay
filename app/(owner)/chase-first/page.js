import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Chase these first" };

export default function ChaseFirstPage() {
  return (
    <>
      <PageHeader title="Chase these first" />
      <EmptyState title="Nothing to show yet" description="This screen will rank every overdue invoice by a score from its amount, days overdue, the customer's reliability and how much it helps the cash gap, with the reason in words." />
    </>
  );
}
