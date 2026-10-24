"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";

// "Send a test event": one ping to n8n, so the owner sees a sheet row and a phone alert arrive.
export default function N8nTest({ labels }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await api("/api/integrations/n8n/test", { method: "POST", body: {} });
          toast(labels[r?.status] ?? labels.failed);
          router.refresh();
        } catch (err) {
          toast(err.message || labels.failed);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? labels.sending : labels.button}
    </Button>
  );
}
