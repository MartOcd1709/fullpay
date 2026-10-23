import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <>
      <PageHeader title="Documents" />
      <EmptyState title="Nothing to show yet" description="This screen will show one timeline per invoice holding the invoice, letters, reminders sent, payments and customer replies, with Download evidence pack opening a print-ready page with all of it." />
    </>
  );
}
