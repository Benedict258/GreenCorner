import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["pg"],
  outputFileTracingRoot: import.meta.dirname,
  // PDFs (quotations, drafts, receipts) read their fonts from disk. They are made by API routes, the
  // Paystack return and webhook (receipts by email) and admin actions, so every server route ships them.
  outputFileTracingIncludes: {
    "/**/*": ["./assets/fonts/**/*"],
  },
  experimental: {
    // The store and the admin area have separate root layouts; this is the 404 for URLs that match neither.
    globalNotFound: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default config;
