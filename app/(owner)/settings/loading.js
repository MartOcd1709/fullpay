import { LoadingRows } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";

export default async function Loading() {
  const T = await getT();
  return <LoadingRows tiles={2} rows={5} label={T("common.loading")} />;
}
