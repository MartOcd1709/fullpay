import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <EmptyState title="Nothing to show yet" description="This screen will hold the business profile, the escalation ladder and safety buffer, language (English / हिंदी) and text size, a Demo date to move today forward, and Reset demo." />
    </>
  );
}
