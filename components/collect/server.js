import { cookies } from "next/headers";
import { run } from "@/lib/services/context";
import { toStatus } from "@/lib/services/errors";

export async function getLang() {
  return (await cookies()).get("lang")?.value === "hi" ? "hi" : "en";
}

// Load page data in one transaction; a failure becomes { error } for the page's ErrorState instead of a crash.
export async function load(fn) {
  try {
    return { data: await run(fn) };
  } catch (err) {
    const e = toStatus(err);
    if (e.status >= 500) console.error("[collect] page load failed:", err);
    return { error: { code: e.code, message: e.status >= 500 ? null : e.message } };
  }
}
