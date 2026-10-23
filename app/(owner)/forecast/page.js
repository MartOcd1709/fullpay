import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Cash forecast" };

export default function ForecastPage() {
  return (
    <>
      <PageHeader title="Cash forecast" />
      <EmptyState title="Nothing to show yet" description="This screen will show the next 13 weeks: opening cash, money expected in, money going out and closing cash, the first week cash drops below the safety buffer, what-if switches, and the invoices that would cover the gap." />
    </>
  );
}
