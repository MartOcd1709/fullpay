import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <>
      <PageHeader title="Inbox" />
      <EmptyState title="Nothing to show yet" description="This screen will show disputes and already-paid claims from customers to resolve: accept (credit note or mark paid), reject with a reply, or edit the invoice. Resolving resumes or stops the ladder." />
    </>
  );
}
