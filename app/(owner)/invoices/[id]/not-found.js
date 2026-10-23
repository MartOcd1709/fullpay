import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { getT } from "@/components/ui/server/lang";

export default async function NotFound() {
  const T = await getT();
  return <EmptyState title={T("core.inv.not_found")} description={T("core.inv.not_found_body")} action={<Button href="/invoices">{T("nav.invoices")}</Button>} />;
}
