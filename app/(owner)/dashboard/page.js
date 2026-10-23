import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <EmptyState title="Nothing to show yet" description="This screen will show the total to collect, overdue, expected this week and this month, bills due in the next 30 days, cash in the bank and the lowest point in the forecast, an ageing bar (not yet due, 1–30, 31–60, 61–90 and 90+ days overdue) and the top 5 from Chase these first." />
    </>
  );
}
