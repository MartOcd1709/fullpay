// Brand wordmark/mark. width/height are each source image's own pixels, reserving the aspect ratio to avoid
// layout shift; className controls the displayed size (e.g. "h-8 w-auto").
//
// The "logo" variant has two PNGs: fullpay-logo.png (navy "Full") for light backgrounds and
// fullpay-logo-dark.png (white "Full") for dark ones — the white version is unreadable on a light header
// (contrast ~1:1), so which one renders is pure CSS (.logo-light/.logo-dark in globals.css), the same
// data-theme / prefers-color-scheme pattern the theme toggle's sun/moon icons use. That's correct before any
// JS runs, and display:none removes the inactive one from the accessibility tree, so screen readers only ever
// see one. The "mark" variant (icon only, no text) has no colour-contrast issue, so it's theme-neutral.
const SIZE = { logo: [1278, 368], "logo-dark": [822, 241], mark: [447, 447] };

export default function Logo({ variant = "logo", className = "h-8 w-auto", alt = "FullPay" }) {
  if (variant === "logo") {
    const [w, h] = SIZE.logo;
    const [wd, hd] = SIZE["logo-dark"];
    return (
      <>
        <img src="/fullpay-logo.png" alt={alt} width={w} height={h} className={`logo-light ${className}`} />
        <img src="/fullpay-logo-dark.png" alt={alt} width={wd} height={hd} className={`logo-dark ${className}`} />
      </>
    );
  }
  const [w, h] = SIZE[variant] ?? SIZE.mark;
  return <img src={`/fullpay-${variant}.png`} alt={alt} width={w} height={h} className={className} />;
}
