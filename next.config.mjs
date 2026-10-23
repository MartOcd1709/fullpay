/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets parallel builders use separate build directories (NEXT_DIST_DIR=.next-a npx next build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Security headers (K31). No frame-denying header: the organisers may show submissions inside an iframe.
  async headers() {
    const common = [
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'" },
    ];
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/:path*", headers: common },
      { source: "/pay/:path*", headers: noindex },
      { source: "/print/:path*", headers: noindex },
      { source: "/api/:path*", headers: noindex },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
