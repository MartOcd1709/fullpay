import Shell from "@/components/public/Shell";
import { getLang, tr } from "@/components/public/lang";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const lang = await getLang();
  const t = tr(lang);
  const keys = ["auth.title", "auth.password", "auth.wrong", "auth.too_many", "btn.login", "error.generic", "error.network", "public.login.intro", "public.login.busy", "public.login.or", "public.landing.open_demo", "public.login.demo_hint"];
  const s = Object.fromEntries(keys.map((k) => [k, t(k)]));
  return (
    <Shell lang={lang}>
      <div className="flex justify-center py-6">
        <LoginForm s={s} demo={process.env.DEMO_MODE === "1"} />
      </div>
    </Shell>
  );
}
