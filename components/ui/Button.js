import Link from "next/link";

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-2 font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const VARIANTS = {
  // hover-lift only on filled/bordered variants: a shadow under a transparent "ghost" button doesn't read well.
  primary: "bg-accent text-on-accent hover:bg-accent-strong hover-lift",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2 hover-lift",
  danger: "bg-error text-on-accent hover:opacity-90 hover-lift",
  ghost: "text-accent hover:bg-accent-soft",
};

export function Button({ variant = "primary", full = false, className = "", href, type = "button", ...props }) {
  const cls = `${BASE} ${VARIANTS[variant] ?? VARIANTS.primary} ${full ? "w-full" : ""} ${className}`;
  if (href) return <Link href={href} className={cls} {...props} />;
  return <button type={type} className={cls} {...props} />;
}

export default Button;
