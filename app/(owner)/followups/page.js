import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Today's follow-ups" };

export default function FollowupsPage() {
  return (
    <>
      <PageHeader title="Today's follow-ups" />
      <EmptyState title="Nothing to show yet" description="This screen will show every reminder the escalation ladder says is due today with the message ready, one-tap WhatsApp, email or SMS, Mark as sent, snooze, and Customer promised to pay on a date." />
    </>
  );
}
