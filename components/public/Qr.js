import { qrSvg } from "@/lib/upi";

// Crisp SVG QR (server-rendered). `size` is any CSS length; the text is ours (a URL or a upi:// string).
export default async function Qr({ text, size = "12rem", label, className = "" }) {
  const svg = await qrSvg(text);
  return (
    <span
      role="img"
      aria-label={label}
      className={`block bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`}
      style={{ width: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
