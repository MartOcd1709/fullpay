import { LoadingRows } from "@/components/collect/kit";
import { getLang } from "@/components/collect/server";
import { t } from "@/lib/i18n";

export default async function Loading() {
  return <LoadingRows label={t("common.loading", await getLang())} />;
}
