/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets parallel builders use separate build directories (NEXT_DIST_DIR=.next-a npx next build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
